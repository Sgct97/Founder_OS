"""FastAPI dependencies — auth, database session, etc."""

import logging
import time
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()

ALLOWED_JWKS_ALGORITHMS = ["ES256", "RS256", "RS384", "RS512", "PS256"]
ALLOWED_HMAC_ALGORITHMS = ["HS256"]

_JWKS_TTL_SECONDS = 3600  # re-fetch keys every hour
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0


async def _get_supabase_jwks() -> dict:
    """Fetch Supabase JWKS (JSON Web Key Set) for JWT verification.

    Cached with a 1-hour TTL so key rotations are picked up automatically.
    """
    global _jwks_cache, _jwks_fetched_at

    now = time.monotonic()
    if _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
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
            _jwks_fetched_at = now
            logger.info(
                "Supabase JWKS loaded — %d key(s)",
                len(_jwks_cache.get("keys", [])),
            )
            return _jwks_cache
    except Exception as exc:
        logger.warning("Failed to fetch Supabase JWKS: %s — falling back to JWT secret", exc)
        _jwks_cache = {"keys": [], "_fallback": True}
        _jwks_fetched_at = now
        return _jwks_cache


def _decode_supabase_jwt(token: str, jwks: dict) -> dict[str, object]:
    """Decode and validate a Supabase-issued JWT.

    Supports both:
      - ES256/RS256 (newer Supabase projects) — verified with JWKS public key
      - HS256 (legacy Supabase projects) — verified with JWT secret

    Algorithm is validated against an explicit whitelist to prevent
    algorithm confusion attacks.
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

    # ── Strategy 1: JWKS public key verification ──
    if keys and token_kid:
        if token_alg not in ALLOWED_JWKS_ALGORITHMS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported token algorithm",
                headers={"WWW-Authenticate": "Bearer"},
            )

        matching_key = next((k for k in keys if k.get("kid") == token_kid), None)

        if matching_key:
            key_alg = matching_key.get("alg", token_alg)
            if key_alg != token_alg:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token algorithm does not match key",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            try:
                public_key = jwk.construct(matching_key, algorithm=key_alg)
                payload: dict[str, object] = jwt.decode(
                    token,
                    public_key,
                    algorithms=[key_alg],
                    audience="authenticated",
                )
                return payload
            except JWTError as exc:
                logger.warning("JWT JWKS decode failed: %s (alg=%s)", exc, key_alg)
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
                algorithms=ALLOWED_HMAC_ALGORITHMS,
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


async def verify_supabase_token(request: Request) -> str:
    """Lightweight dependency that verifies the Supabase JWT and returns the sub claim.

    Use on public-facing auth endpoints (signup, login, join) so the
    supabase_uid is extracted from the cryptographically verified token
    rather than trusted from the request body.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_header[7:]

    jwks = await _get_supabase_jwks()
    payload = _decode_supabase_jwt(token, jwks)

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return sub


VerifiedSupabaseUid = Annotated[str, Depends(verify_supabase_token)]


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
