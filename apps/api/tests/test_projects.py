"""Tests for project CRUD — workspace isolation is the critical guarantee."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.dependencies import get_current_user
from app.main import app
from app.models.user import User
from app.models.workspace import Workspace
from tests.conftest import TestSessionLocal


async def _make_authed_user(
    *,
    email: str,
    workspace_name: str,
    supabase_uid: str,
) -> uuid.UUID:
    async with TestSessionLocal() as session:
        workspace = Workspace(name=workspace_name)
        session.add(workspace)
        await session.flush()
        user = User(
            email=email,
            display_name=email.split("@")[0],
            supabase_uid=supabase_uid,
            workspace_id=workspace.id,
        )
        session.add(user)
        await session.commit()
        return user.id


def _override_user(user_id: uuid.UUID) -> None:
    async def _override() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override


@pytest.fixture
async def authed_client(client: AsyncClient) -> AsyncClient:
    user_id = await _make_authed_user(
        email="proj@example.com",
        workspace_name="Proj WS",
        supabase_uid="sb-proj-uid",
    )
    _override_user(user_id)
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_create_and_list_project(authed_client: AsyncClient) -> None:
    create = await authed_client.post(
        "/api/v1/projects",
        json={
            "name": "Acme Portal",
            "brief": "Client delivery for Acme",
            "github_url": "https://github.com/acme/portal",
            "preview_url": "https://acme.onrender.com",
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["name"] == "Acme Portal"
    assert body["preview_url"] == "https://acme.onrender.com"
    assert body["github_url"] == "https://github.com/acme/portal"

    listed = await authed_client.get("/api/v1/projects")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == body["id"]


@pytest.mark.asyncio
async def test_get_update_delete_project(authed_client: AsyncClient) -> None:
    created = await authed_client.post(
        "/api/v1/projects",
        json={"name": "Job One", "brief": "v1"},
    )
    project_id = created.json()["id"]

    got = await authed_client.get(f"/api/v1/projects/{project_id}")
    assert got.status_code == 200
    assert got.json()["name"] == "Job One"

    patched = await authed_client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Job One Renamed", "preview_url": "https://x.onrender.com"},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Job One Renamed"
    assert patched.json()["preview_url"] == "https://x.onrender.com"

    deleted = await authed_client.delete(f"/api/v1/projects/{project_id}")
    assert deleted.status_code == 204

    missing = await authed_client.get(f"/api/v1/projects/{project_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_project_not_visible_across_workspaces(client: AsyncClient) -> None:
    """Workspace B must not see or mutate Workspace A's project."""
    user_a = await _make_authed_user(
        email="owner-a@example.com",
        workspace_name="Workspace A",
        supabase_uid="sb-owner-a",
    )
    _override_user(user_a)

    create = await client.post(
        "/api/v1/projects",
        json={"name": "Secret Project", "brief": "private"},
    )
    assert create.status_code == 201
    project_id = create.json()["id"]

    user_b = await _make_authed_user(
        email="owner-b@example.com",
        workspace_name="Workspace B",
        supabase_uid="sb-owner-b",
    )
    _override_user(user_b)

    listed = await client.get("/api/v1/projects")
    assert listed.status_code == 200
    assert listed.json() == []

    assert (await client.get(f"/api/v1/projects/{project_id}")).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/projects/{project_id}", json={"name": "Hijacked"}
        )
    ).status_code == 404
    assert (await client.delete(f"/api/v1/projects/{project_id}")).status_code == 404

    _override_user(user_a)
    still_there = await client.get(f"/api/v1/projects/{project_id}")
    assert still_there.status_code == 200
    assert still_there.json()["name"] == "Secret Project"

    app.dependency_overrides.pop(get_current_user, None)
