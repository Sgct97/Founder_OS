"""Tests for auth dependencies — JWT decode, get_current_user."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from jose import jwt as jose_jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import _decode_supabase_jwt, _get_supabase_jwks, get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_get_supabase_jwks_raises_without_url() -> None:
    """Should raise 500 if SUPABASE_URL is empty."""
    import app.dependencies as deps

    original = deps._jwks_cache
    deps._jwks_cache = None
    try:
        with patch("app.dependencies.settings") as mock_settings:
            mock_settings.supabase_url = ""
            with pytest.raises(HTTPException) as exc_info:
                await _get_supabase_jwks()
            assert exc_info.value.status_code == 500
    finally:
        deps._jwks_cache = original


@pytest.mark.asyncio
async def test_get_supabase_jwks_returns_cached() -> None:
    """Should return cached JWKS if already fetched."""
    import app.dependencies as deps

    original = deps._jwks_cache
    cached = {"keys": [{"kid": "test", "alg": "ES256"}]}
    deps._jwks_cache = cached
    try:
        result = await _get_supabase_jwks()
        assert result == cached
    finally:
        deps._jwks_cache = original


@pytest.mark.asyncio
async def test_get_supabase_jwks_falls_back_on_failure() -> None:
    """Should fall back gracefully if JWKS fetch fails."""
    import app.dependencies as deps

    original = deps._jwks_cache
    deps._jwks_cache = None
    try:
        with patch("app.dependencies.settings") as mock_settings:
            mock_settings.supabase_url = "https://bad-url.example.com"
            mock_settings.supabase_service_key = ""
        
            with patch("app.dependencies.httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(side_effect=Exception("Network error"))
                mock_client_cls.return_value = mock_client

                result = await _get_supabase_jwks()
                assert result == {"keys": [], "_fallback": True}
    finally:
        deps._jwks_cache = original


def test_decode_jwt_invalid_token_raises_401() -> None:
    """An invalid JWT string should raise 401."""
    jwks = {"keys": [], "_fallback": True}
    with patch("app.dependencies.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = "some-secret"
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt("not-a-valid-jwt", jwks)
        assert exc_info.value.status_code == 401


def test_decode_jwt_valid_hs256_token() -> None:
    """A properly signed HS256 JWT should decode successfully via fallback."""
    secret = "test-secret-123"
    payload = {"sub": "user-abc", "aud": "authenticated"}
    token = jose_jwt.encode(payload, secret, algorithm="HS256")

    jwks = {"keys": [], "_fallback": True}
    with patch("app.dependencies.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = secret
        decoded = _decode_supabase_jwt(token, jwks)
        assert decoded["sub"] == "user-abc"


def test_decode_jwt_wrong_secret_raises_401() -> None:
    """A JWT signed with a different secret should raise 401."""
    token = jose_jwt.encode(
        {"sub": "user-abc", "aud": "authenticated"}, "real-secret", algorithm="HS256"
    )

    jwks = {"keys": [], "_fallback": True}
    with patch("app.dependencies.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = "wrong-secret"
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt(token, jwks)
        assert exc_info.value.status_code == 401


def test_decode_jwt_no_matching_key_no_secret_raises_401() -> None:
    """If there's no matching JWKS key and no JWT secret, should raise 401."""
    token = jose_jwt.encode(
        {"sub": "user-abc", "aud": "authenticated"}, "any-secret", algorithm="HS256"
    )

    jwks = {"keys": [{"kid": "different-kid", "alg": "ES256"}]}
    with patch("app.dependencies.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = ""
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt(token, jwks)
        assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_missing_sub_raises_401() -> None:
    """JWT without 'sub' claim should raise 401."""
    credentials = MagicMock()
    credentials.credentials = "some-token"

    db = AsyncMock(spec=AsyncSession)

    with (
        patch("app.dependencies._get_supabase_jwks", return_value={"keys": []}),
        patch(
            "app.dependencies._decode_supabase_jwt",
            return_value={"aud": "authenticated"},  # no 'sub'
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)
        assert exc_info.value.status_code == 401
        assert "subject" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_user_not_in_db_raises_401() -> None:
    """Valid JWT but user not in DB should raise 401."""
    credentials = MagicMock()
    credentials.credentials = "some-token"

    async with TestSessionLocal() as session:
        with (
            patch("app.dependencies._get_supabase_jwks", return_value={"keys": []}),
            patch(
                "app.dependencies._decode_supabase_jwt",
                return_value={"sub": "nonexistent-uid", "aud": "authenticated"},
            ),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials, session)
            assert exc_info.value.status_code == 401
            assert "not found" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_returns_user_on_valid_jwt() -> None:
    """Valid JWT + user in DB should return the User object."""
    async with TestSessionLocal() as session:
        workspace = Workspace(name="Test WS")
        session.add(workspace)
        await session.flush()

        user = User(
            email="jwtuser@example.com",
            display_name="JWT User",
            supabase_uid="sb-jwt-test-uid",
            workspace_id=workspace.id,
        )
        session.add(user)
        await session.commit()

        credentials = MagicMock()
        credentials.credentials = "valid-token"

        with (
            patch("app.dependencies._get_supabase_jwks", return_value={"keys": []}),
            patch(
                "app.dependencies._decode_supabase_jwt",
                return_value={"sub": "sb-jwt-test-uid", "aud": "authenticated"},
            ),
        ):
            result = await get_current_user(credentials, session)
            assert result.email == "jwtuser@example.com"
            assert result.supabase_uid == "sb-jwt-test-uid"
