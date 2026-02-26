"""Tests for milestone and phase endpoints — CRUD + edge cases."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.dependencies import get_current_user
from app.main import app
from app.models.milestone import Milestone
from app.models.phase import Phase
from app.models.user import User
from app.models.workspace import Workspace
from tests.conftest import TestSessionLocal


# ── Helpers ──────────────────────────────────────────────────────


@pytest.fixture
async def authed_client(client: AsyncClient) -> AsyncClient:
    """Client with auth overridden to return a real test user in a workspace."""
    async with TestSessionLocal() as session:
        workspace = Workspace(name="Milestone WS")
        session.add(workspace)
        await session.flush()

        user = User(
            email="milestone@example.com",
            display_name="Milestone User",
            supabase_uid="sb-milestone-uid",
            workspace_id=workspace.id,
        )
        session.add(user)
        await session.commit()

        user_id = user.id

    async def _override() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def authed_client_no_workspace(client: AsyncClient) -> AsyncClient:
    """Client with auth overridden to return a user without a workspace."""
    async with TestSessionLocal() as session:
        user = User(
            email="orphan-ms@example.com",
            display_name="Orphan MS",
            supabase_uid="sb-orphan-ms-uid",
            workspace_id=None,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    async def _override() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override
    yield client
    app.dependency_overrides.pop(get_current_user, None)


# ── Phase CRUD ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_phase(authed_client: AsyncClient) -> None:
    """POST /api/v1/phases should create a phase (201)."""
    response = await authed_client.post(
        "/api/v1/phases",
        json={"title": "Phase 1: Blueprint", "sort_order": 0},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Phase 1: Blueprint"
    assert data["sort_order"] == 0
    assert "id" in data
    assert "workspace_id" in data


@pytest.mark.asyncio
async def test_create_phase_with_description(authed_client: AsyncClient) -> None:
    """Phase creation with optional description should persist it."""
    response = await authed_client.post(
        "/api/v1/phases",
        json={
            "title": "Phase 2: Foundation",
            "description": "Core infrastructure setup",
            "sort_order": 1,
        },
    )
    assert response.status_code == 201
    assert response.json()["description"] == "Core infrastructure setup"


@pytest.mark.asyncio
async def test_list_phases_empty(authed_client: AsyncClient) -> None:
    """GET /api/v1/phases should return empty list when no phases exist."""
    response = await authed_client.get("/api/v1/phases")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_phases_with_milestones(authed_client: AsyncClient) -> None:
    """GET /api/v1/phases should return phases with nested milestones."""
    # Create a phase.
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    # Add a milestone.
    await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Set up CI/CD"},
    )

    response = await authed_client.get("/api/v1/phases")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Phase 1"
    assert len(data[0]["milestones"]) == 1
    assert data[0]["milestones"][0]["title"] == "Set up CI/CD"


@pytest.mark.asyncio
async def test_update_phase(authed_client: AsyncClient) -> None:
    """PATCH /api/v1/phases/{id} should update the phase."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Old Title"}
    )
    phase_id = phase_resp.json()["id"]

    response = await authed_client.patch(
        f"/api/v1/phases/{phase_id}",
        json={"title": "New Title", "sort_order": 5},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "New Title"
    assert response.json()["sort_order"] == 5


@pytest.mark.asyncio
async def test_update_phase_not_found(authed_client: AsyncClient) -> None:
    """PATCH on a nonexistent phase should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.patch(
        f"/api/v1/phases/{fake_id}", json={"title": "Nope"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_phase(authed_client: AsyncClient) -> None:
    """DELETE /api/v1/phases/{id} should remove the phase (204)."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "To Delete"}
    )
    phase_id = phase_resp.json()["id"]

    response = await authed_client.delete(f"/api/v1/phases/{phase_id}")
    assert response.status_code == 204

    # Verify it's gone.
    list_resp = await authed_client.get("/api/v1/phases")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_phase_not_found(authed_client: AsyncClient) -> None:
    """DELETE on a nonexistent phase should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.delete(f"/api/v1/phases/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_phase_cascades_milestones(authed_client: AsyncClient) -> None:
    """Deleting a phase should delete all its milestones."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Cascade Phase"}
    )
    phase_id = phase_resp.json()["id"]

    await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Will be deleted"},
    )

    # Delete the phase.
    response = await authed_client.delete(f"/api/v1/phases/{phase_id}")
    assert response.status_code == 204

    # Verify milestones are gone.
    list_resp = await authed_client.get("/api/v1/phases")
    assert len(list_resp.json()) == 0


# ── Milestone CRUD ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_milestone(authed_client: AsyncClient) -> None:
    """POST /api/v1/phases/{id}/milestones should create a milestone (201)."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    response = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Design schema", "description": "SQL tables"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Design schema"
    assert data["description"] == "SQL tables"
    assert data["status"] == "not_started"
    assert data["phase_id"] == phase_id


@pytest.mark.asyncio
async def test_create_milestone_with_status(authed_client: AsyncClient) -> None:
    """Creating a milestone with explicit status should persist it."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    response = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Already started", "status": "in_progress"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_create_milestone_invalid_phase(authed_client: AsyncClient) -> None:
    """Creating a milestone for a nonexistent phase should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.post(
        f"/api/v1/phases/{fake_id}/milestones",
        json={"title": "Orphan milestone"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_milestone_status(authed_client: AsyncClient) -> None:
    """PATCH /api/v1/milestones/{id} should update the milestone."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    ms_resp = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Test milestone"},
    )
    ms_id = ms_resp.json()["id"]

    response = await authed_client.patch(
        f"/api/v1/milestones/{ms_id}",
        json={"status": "completed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_update_milestone_title(authed_client: AsyncClient) -> None:
    """Updating a milestone's title should persist it."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    ms_resp = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Old Name"},
    )
    ms_id = ms_resp.json()["id"]

    response = await authed_client.patch(
        f"/api/v1/milestones/{ms_id}",
        json={"title": "New Name"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "New Name"


@pytest.mark.asyncio
async def test_update_milestone_not_found(authed_client: AsyncClient) -> None:
    """PATCH on a nonexistent milestone should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.patch(
        f"/api/v1/milestones/{fake_id}", json={"title": "Nope"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_milestone(authed_client: AsyncClient) -> None:
    """DELETE /api/v1/milestones/{id} should remove the milestone (204)."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    ms_resp = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "To delete"},
    )
    ms_id = ms_resp.json()["id"]

    response = await authed_client.delete(f"/api/v1/milestones/{ms_id}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_milestone_not_found(authed_client: AsyncClient) -> None:
    """DELETE on a nonexistent milestone should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.delete(f"/api/v1/milestones/{fake_id}")
    assert response.status_code == 404


# ── Auth / workspace edge cases ──────────────────────────────────


@pytest.mark.asyncio
async def test_phases_without_auth_returns_403(client: AsyncClient) -> None:
    """GET /api/v1/phases without token should return 403."""
    response = await client.get("/api/v1/phases")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_phase_no_workspace(
    authed_client_no_workspace: AsyncClient,
) -> None:
    """Creating a phase without a workspace should return 400."""
    response = await authed_client_no_workspace.post(
        "/api/v1/phases", json={"title": "Fail"}
    )
    assert response.status_code == 400
    assert "workspace" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_phase_invalid_body(authed_client: AsyncClient) -> None:
    """Empty title should return 422 validation error."""
    response = await authed_client.post(
        "/api/v1/phases", json={"title": ""}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_milestone_invalid_status(authed_client: AsyncClient) -> None:
    """Invalid milestone status should return 422."""
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    response = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Bad status", "status": "bogus"},
    )
    assert response.status_code == 422


# ── Model repr ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_phase_repr(client: AsyncClient) -> None:
    """Phase.__repr__ should contain title."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr WS")
        session.add(ws)
        await session.flush()
        phase = Phase(workspace_id=ws.id, title="Repr Phase")
        session.add(phase)
        await session.flush()
        r = repr(phase)
        assert "Repr Phase" in r
        assert "Phase" in r


@pytest.mark.asyncio
async def test_milestone_repr(client: AsyncClient) -> None:
    """Milestone.__repr__ should contain title and status."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr WS")
        session.add(ws)
        await session.flush()
        phase = Phase(workspace_id=ws.id, title="P1")
        session.add(phase)
        await session.flush()
        ms = Milestone(phase_id=phase.id, title="Repr MS", status="in_progress")
        session.add(ms)
        await session.flush()
        r = repr(ms)
        assert "Repr MS" in r
        assert "in_progress" in r


@pytest.mark.asyncio
async def test_phases_sorted_by_sort_order(authed_client: AsyncClient) -> None:
    """Phases should be returned sorted by sort_order."""
    await authed_client.post("/api/v1/phases", json={"title": "B", "sort_order": 2})
    await authed_client.post("/api/v1/phases", json={"title": "A", "sort_order": 1})
    await authed_client.post("/api/v1/phases", json={"title": "C", "sort_order": 3})

    response = await authed_client.get("/api/v1/phases")
    titles = [p["title"] for p in response.json()]
    assert titles == ["A", "B", "C"]

