"""FastAPI dependencies — auth, database session, etc."""

import logging
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()

# Cache for Supabase JWKS — populated on first request.
_jwks_cache: dict | None = None


async def _get_supabase_jwks() -> dict:
    """Fetch Supabase JWKS (JSON Web Key Set) for JWT verification.

    Results are cached in-memory so we only hit Supabase once per
    process lifetime.  Newer Supabase projects sign tokens with ES256
    (ECDSA P-256) and expose the public key at the JWKS endpoint.
    """
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured",
        )

    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    logger.info("Fetching Supabase JWKS from %s", jwks_url)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            logger.info(
                "Supabase JWKS loaded — %d key(s)",
                len(_jwks_cache.get("keys", [])),
            )
            return _jwks_cache
    except Exception as exc:
        logger.warning("Failed to fetch Supabase JWKS: %s — falling back to JWT secret", exc)
        # Fall back to HS256 with the JWT secret
        _jwks_cache = {"keys": [], "_fallback": True}
        return _jwks_cache


def _decode_supabase_jwt(token: str, jwks: dict) -> dict[str, object]:
    """Decode and validate a Supabase-issued JWT.

    Supports both:
      • ES256 (newer Supabase projects) — verified with JWKS public key
      • HS256 (legacy Supabase projects) — verified with JWT secret
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
        token_alg = unverified_header.get("alg", "unknown")
        token_kid = unverified_header.get("kid")
        logger.debug("JWT header: alg=%s kid=%s", token_alg, token_kid)
    except JWTError as exc:
        logger.warning("Cannot read JWT header: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    keys = jwks.get("keys", [])
    is_fallback = jwks.get("_fallback", False)

    # ── Strategy 1: JWKS public key verification (ES256 / RS256 etc.) ──
    if keys and token_kid:
        matching_key = None
        for k in keys:
            if k.get("kid") == token_kid:
                matching_key = k
                break

        if matching_key:
            try:
                public_key = jwk.construct(matching_key, algorithm=token_alg)
                payload: dict[str, object] = jwt.decode(
                    token,
                    public_key,
                    algorithms=[token_alg],
                    audience="authenticated",
                )
                return payload
            except JWTError as exc:
                logger.warning("JWT JWKS decode failed: %s (alg=%s)", exc, token_alg)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                ) from exc

    # ── Strategy 2: HS256 with JWT secret (fallback / legacy) ──
    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience="authenticated",
            )
            return payload
        except JWTError as exc:
            logger.warning("JWT HS256 decode failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    logger.error("No JWKS key matched kid=%s and no JWT secret configured", token_kid)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Cannot verify token — no matching key",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate the JWT, then load the User from the database.

    This is the primary auth dependency — inject it into any protected route.
    """
    jwks = await _get_supabase_jwks()
    payload = _decode_supabase_jwt(credentials.credentials, jwks)

    supabase_uid = payload.get("sub")
    if not supabase_uid or not isinstance(supabase_uid, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(
        select(User).where(User.supabase_uid == supabase_uid)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found — please sign up first",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Convenience type alias for route handler signatures.
CurrentUser = Annotated[User, Depends(get_current_user)]
