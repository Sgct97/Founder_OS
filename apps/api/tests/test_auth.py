"""Tests for the auth router — signup, login, join, invite, me."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, get_current_user
from app.main import app
from app.models.user import User
from app.models.workspace import Workspace
from tests.conftest import TestSessionLocal, make_signup_payload


# ── Signup ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_signup_creates_user_and_workspace(client: AsyncClient) -> None:
    """POST /api/v1/auth/signup should create a user + workspace (201)."""
    payload = make_signup_payload()
    response = await client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == payload["email"]
    assert data["user"]["display_name"] == payload["display_name"]
    assert data["workspace"]["name"] == payload["workspace_name"]
    assert data["workspace"]["invite_code"] is not None


@pytest.mark.asyncio
async def test_signup_duplicate_email_returns_409(client: AsyncClient) -> None:
    """Duplicate email signup should return 409 Conflict."""
    payload = make_signup_payload(email="dup@example.com")
    await client.post("/api/v1/auth/signup", json=payload)
    payload2 = make_signup_payload(email="dup@example.com")
    response = await client.post("/api/v1/auth/signup", json=payload2)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_signup_duplicate_uid_returns_409(client: AsyncClient) -> None:
    """Duplicate supabase_uid signup should return 409 Conflict."""
    uid = "sb-duplicate-uid-test"
    payload = make_signup_payload(supabase_uid=uid)
    await client.post("/api/v1/auth/signup", json=payload)
    payload2 = make_signup_payload(supabase_uid=uid)
    response = await client.post("/api/v1/auth/signup", json=payload2)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_signup_invalid_email_returns_422(client: AsyncClient) -> None:
    """Invalid email should return 422 Unprocessable Entity."""
    payload = make_signup_payload(email="not-an-email")
    response = await client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 422


# ── Login ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_existing_user_returns_profile(client: AsyncClient) -> None:
    """POST /api/v1/auth/login should return user + workspace for known UID."""
    signup = make_signup_payload()
    await client.post("/api/v1/auth/signup", json=signup)
    response = await client.post(
        "/api/v1/auth/login",
        json={"supabase_uid": signup["supabase_uid"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == signup["email"]
    assert data["workspace"] is not None


@pytest.mark.asyncio
async def test_login_unknown_uid_returns_404(client: AsyncClient) -> None:
    """Login with unknown UID should return 404."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"supabase_uid": "sb-nonexistent-xyz"},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Join Workspace ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_join_workspace_via_invite_code(client: AsyncClient) -> None:
    """POST /api/v1/auth/join should add a user to an existing workspace."""
    # First user creates workspace.
    signup = make_signup_payload()
    signup_resp = await client.post("/api/v1/auth/signup", json=signup)
    invite_code = signup_resp.json()["workspace"]["invite_code"]

    # Second user joins via invite code.
    join_payload = {
        "invite_code": invite_code,
        "email": "cofounder@example.com",
        "display_name": "Co-Founder",
        "supabase_uid": "sb-cofounder-uid",
    }
    response = await client.post("/api/v1/auth/join", json=join_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "cofounder@example.com"
    assert data["workspace"]["invite_code"] == invite_code


@pytest.mark.asyncio
async def test_join_invalid_invite_code_returns_404(client: AsyncClient) -> None:
    """Invalid invite code should return 404."""
    join_payload = {
        "invite_code": "BADCODE1",
        "email": "nobody@example.com",
        "display_name": "Nobody",
        "supabase_uid": "sb-nobody-uid",
    }
    response = await client.post("/api/v1/auth/join", json=join_payload)
    assert response.status_code == 404
    assert "invite code" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_join_duplicate_email_returns_409(client: AsyncClient) -> None:
    """Joining with an already-registered email should return 409."""
    signup = make_signup_payload(email="taken@example.com")
    signup_resp = await client.post("/api/v1/auth/signup", json=signup)
    invite_code = signup_resp.json()["workspace"]["invite_code"]

    join_payload = {
        "invite_code": invite_code,
        "email": "taken@example.com",
        "display_name": "Duplicate",
        "supabase_uid": "sb-dup-join-uid",
    }
    response = await client.post("/api/v1/auth/join", json=join_payload)
    assert response.status_code == 409


# ── Response Schema Validation ───────────────────────────────────


@pytest.mark.asyncio
async def test_signup_response_has_required_fields(client: AsyncClient) -> None:
    """AuthResponse must include user and workspace with all key fields."""
    payload = make_signup_payload()
    response = await client.post("/api/v1/auth/signup", json=payload)
    data = response.json()

    user = data["user"]
    assert "id" in user
    assert "email" in user
    assert "display_name" in user
    assert "workspace_id" in user
    assert "created_at" in user
    assert "updated_at" in user

    ws = data["workspace"]
    assert "id" in ws
    assert "name" in ws
    assert "invite_code" in ws
    assert "created_at" in ws


# ── Join duplicate UID ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_join_duplicate_uid_returns_409(client: AsyncClient) -> None:
    """Joining with a UID that already exists should return 409."""
    signup = make_signup_payload()
    signup_resp = await client.post("/api/v1/auth/signup", json=signup)
    invite_code = signup_resp.json()["workspace"]["invite_code"]

    join_payload = {
        "invite_code": invite_code,
        "email": "unique@example.com",
        "display_name": "Another",
        "supabase_uid": signup["supabase_uid"],  # same UID as first user
    }
    response = await client.post("/api/v1/auth/join", json=join_payload)
    assert response.status_code == 409


# ── Protected endpoints (require auth) ──────────────────────────


async def _create_authed_client(
    client: AsyncClient,
) -> tuple[AsyncClient, dict[str, str]]:
    """Helper: signup a user and return (client, signup_data)."""
    payload = make_signup_payload()
    await client.post("/api/v1/auth/signup", json=payload)
    return client, payload


@pytest.fixture
async def authed_client(client: AsyncClient) -> AsyncClient:
    """Client with auth dependency overridden to return a real test user."""
    # Create a user via the normal signup flow.
    payload = make_signup_payload()
    resp = await client.post("/api/v1/auth/signup", json=payload)
    user_data = resp.json()["user"]
    workspace_data = resp.json()["workspace"]

    # Fetch the real User from the DB.
    async with TestSessionLocal() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(User).where(User.id == uuid.UUID(user_data["id"]))
        )
        user = result.scalar_one()

        ws_result = await session.execute(
            select(Workspace).where(Workspace.id == uuid.UUID(workspace_data["id"]))
        )
        workspace = ws_result.scalar_one()

    # Build a detached user with workspace for the dependency override.
    async def _override_current_user() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(
                select(User).where(User.id == uuid.UUID(user_data["id"]))
            )
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override_current_user
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_me_returns_current_user(authed_client: AsyncClient) -> None:
    """GET /api/v1/auth/me should return the authenticated user."""
    response = await authed_client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert data["user"]["email"] is not None
    assert data["workspace"] is not None


@pytest.mark.asyncio
async def test_regenerate_invite_returns_new_code(
    authed_client: AsyncClient,
) -> None:
    """POST /api/v1/auth/invite should return a new invite code."""
    response = await authed_client.post("/api/v1/auth/invite")
    assert response.status_code == 200
    data = response.json()
    assert "invite_code" in data
    assert len(data["invite_code"]) == 8


@pytest.mark.asyncio
async def test_me_without_auth_returns_401(client: AsyncClient) -> None:
    """GET /api/v1/auth/me without token should return 403 (HTTPBearer)."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 403  # HTTPBearer returns 403 when missing


@pytest.mark.asyncio
async def test_invite_without_auth_returns_401(client: AsyncClient) -> None:
    """POST /api/v1/auth/invite without token should return 403."""
    response = await client.post("/api/v1/auth/invite")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_invite_user_without_workspace_returns_400(
    client: AsyncClient,
) -> None:
    """POST /api/v1/auth/invite should return 400 if user has no workspace."""
    # Create a user with no workspace via direct DB insertion.
    async with TestSessionLocal() as session:
        user = User(
            email="orphan@example.com",
            display_name="Orphan",
            supabase_uid="sb-orphan-uid",
            workspace_id=None,
        )
        session.add(user)
        await session.commit()

        async def _override_no_ws_user() -> User:
            async with TestSessionLocal() as s:
                from sqlalchemy import select as sel
                r = await s.execute(
                    sel(User).where(User.supabase_uid == "sb-orphan-uid")
                )
                return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override_no_ws_user
    response = await client.post("/api/v1/auth/invite")
    app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 400
    assert "workspace" in response.json()["detail"].lower()


# ── Model __repr__ ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_repr(client: AsyncClient) -> None:
    """User.__repr__ should include id and email."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="repr@example.com",
            display_name="Repr",
            supabase_uid="sb-repr-uid",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()
        r = repr(user)
        assert "repr@example.com" in r
        assert "User" in r


@pytest.mark.asyncio
async def test_workspace_repr(client: AsyncClient) -> None:
    """Workspace.__repr__ should include id and name."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr WS 2")
        session.add(ws)
        await session.flush()
        r = repr(ws)
        assert "Repr WS 2" in r
        assert "Workspace" in r

