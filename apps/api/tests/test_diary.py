"""Tests for diary entry endpoints — CRUD, streaks, filtering, edge cases."""

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.dependencies import get_current_user
from app.main import app
from app.models.diary_entry import DiaryEntry
from app.models.milestone import Milestone
from app.models.phase import Phase
from app.models.user import User
from app.models.workspace import Workspace
from tests.conftest import TestSessionLocal


# ── Helpers ──────────────────────────────────────────────────────


async def _create_workspace_and_user(
    email: str = "diary@example.com",
    display_name: str = "Diary User",
    uid: str = "sb-diary-uid",
) -> tuple[uuid.UUID, uuid.UUID]:
    """Create a workspace and user, return (workspace_id, user_id)."""
    async with TestSessionLocal() as session:
        workspace = Workspace(name="Diary WS")
        session.add(workspace)
        await session.flush()

        user = User(
            email=email,
            display_name=display_name,
            supabase_uid=uid,
            workspace_id=workspace.id,
        )
        session.add(user)
        await session.commit()
        return workspace.id, user.id


@pytest.fixture
async def authed_client(client: AsyncClient) -> AsyncClient:
    """Client with auth overridden to return a real test user."""
    workspace_id, user_id = await _create_workspace_and_user()

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
            email="orphan-diary@example.com",
            display_name="Orphan Diary",
            supabase_uid="sb-orphan-diary-uid",
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


# ── Diary Entry CRUD ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_diary_entry(authed_client: AsyncClient) -> None:
    """POST /api/v1/diary should create an entry (201)."""
    today = date.today().isoformat()
    response = await authed_client.post(
        "/api/v1/diary",
        json={
            "entry_date": today,
            "description": "Worked on auth flow.",
            "hours_worked": 3.5,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == "Worked on auth flow."
    assert data["entry_date"] == today
    assert data["hours_worked"] == 3.5
    assert data["author"]["display_name"] == "Diary User"
    assert data["milestone"] is None


@pytest.mark.asyncio
async def test_create_diary_entry_with_milestone(authed_client: AsyncClient) -> None:
    """Creating an entry linked to a milestone should include milestone info."""
    # Create a phase + milestone first.
    phase_resp = await authed_client.post(
        "/api/v1/phases", json={"title": "Phase 1"}
    )
    phase_id = phase_resp.json()["id"]

    ms_resp = await authed_client.post(
        f"/api/v1/phases/{phase_id}/milestones",
        json={"title": "Auth Setup"},
    )
    ms_id = ms_resp.json()["id"]

    response = await authed_client.post(
        "/api/v1/diary",
        json={
            "entry_date": date.today().isoformat(),
            "description": "Built auth module",
            "milestone_id": ms_id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["milestone"] is not None
    assert data["milestone"]["title"] == "Auth Setup"


@pytest.mark.asyncio
async def test_create_diary_entry_invalid_milestone(authed_client: AsyncClient) -> None:
    """Linking to a nonexistent milestone should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.post(
        "/api/v1/diary",
        json={
            "entry_date": date.today().isoformat(),
            "description": "Bad milestone",
            "milestone_id": fake_id,
        },
    )
    assert response.status_code == 404
    assert "milestone" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_diary_entries(authed_client: AsyncClient) -> None:
    """GET /api/v1/diary should return entries in reverse chronological order."""
    today = date.today()
    yesterday = today - timedelta(days=1)

    await authed_client.post(
        "/api/v1/diary",
        json={"entry_date": yesterday.isoformat(), "description": "Yesterday work"},
    )
    await authed_client.post(
        "/api/v1/diary",
        json={"entry_date": today.isoformat(), "description": "Today work"},
    )

    response = await authed_client.get("/api/v1/diary")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Most recent first.
    assert data[0]["description"] == "Today work"
    assert data[1]["description"] == "Yesterday work"


@pytest.mark.asyncio
async def test_list_diary_entries_empty(authed_client: AsyncClient) -> None:
    """GET /api/v1/diary should return empty list when no entries exist."""
    response = await authed_client.get("/api/v1/diary")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_diary_entries_filter_date_range(authed_client: AsyncClient) -> None:
    """Filtering by date range should work correctly."""
    today = date.today()
    week_ago = today - timedelta(days=7)

    await authed_client.post(
        "/api/v1/diary",
        json={"entry_date": today.isoformat(), "description": "Recent"},
    )
    await authed_client.post(
        "/api/v1/diary",
        json={"entry_date": week_ago.isoformat(), "description": "Old"},
    )

    # Only get entries from yesterday onward.
    yesterday = (today - timedelta(days=1)).isoformat()
    response = await authed_client.get(f"/api/v1/diary?from={yesterday}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "Recent"


@pytest.mark.asyncio
async def test_update_diary_entry(authed_client: AsyncClient) -> None:
    """PATCH /api/v1/diary/{id} should update the entry."""
    create_resp = await authed_client.post(
        "/api/v1/diary",
        json={
            "entry_date": date.today().isoformat(),
            "description": "Original text",
        },
    )
    entry_id = create_resp.json()["id"]

    response = await authed_client.patch(
        f"/api/v1/diary/{entry_id}",
        json={"description": "Updated text", "hours_worked": 5.0},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Updated text"
    assert response.json()["hours_worked"] == 5.0


@pytest.mark.asyncio
async def test_update_diary_entry_not_found(authed_client: AsyncClient) -> None:
    """PATCH on a nonexistent entry should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.patch(
        f"/api/v1/diary/{fake_id}",
        json={"description": "Nope"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_diary_entry(authed_client: AsyncClient) -> None:
    """DELETE /api/v1/diary/{id} should remove the entry (204)."""
    create_resp = await authed_client.post(
        "/api/v1/diary",
        json={
            "entry_date": date.today().isoformat(),
            "description": "To delete",
        },
    )
    entry_id = create_resp.json()["id"]

    response = await authed_client.delete(f"/api/v1/diary/{entry_id}")
    assert response.status_code == 204

    # Verify it's gone.
    list_resp = await authed_client.get("/api/v1/diary")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_diary_entry_not_found(authed_client: AsyncClient) -> None:
    """DELETE on a nonexistent entry should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.delete(f"/api/v1/diary/{fake_id}")
    assert response.status_code == 404


# ── Ownership protection ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_other_users_entry_returns_403(
    client: AsyncClient,
) -> None:
    """Updating another user's diary entry should return 403."""
    # Create user A and their entry.
    ws_id, user_a_id = await _create_workspace_and_user(
        email="userA@example.com", uid="sb-user-a"
    )

    async with TestSessionLocal() as session:
        entry = DiaryEntry(
            workspace_id=ws_id,
            author_id=user_a_id,
            entry_date=date.today(),
            description="User A's entry",
        )
        session.add(entry)
        await session.commit()
        entry_id = entry.id

    # Create user B in the same workspace.
    async with TestSessionLocal() as session:
        user_b = User(
            email="userB@example.com",
            display_name="User B",
            supabase_uid="sb-user-b",
            workspace_id=ws_id,
        )
        session.add(user_b)
        await session.commit()
        user_b_id = user_b.id

    # Override auth to be user B.
    async def _override_b() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_b_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override_b

    response = await client.patch(
        f"/api/v1/diary/{entry_id}",
        json={"description": "Trying to edit A's entry"},
    )
    assert response.status_code == 403
    assert "own" in response.json()["detail"].lower()

    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_delete_other_users_entry_returns_403(
    client: AsyncClient,
) -> None:
    """Deleting another user's diary entry should return 403."""
    ws_id, user_a_id = await _create_workspace_and_user(
        email="delA@example.com", uid="sb-del-a"
    )

    async with TestSessionLocal() as session:
        entry = DiaryEntry(
            workspace_id=ws_id,
            author_id=user_a_id,
            entry_date=date.today(),
            description="User A's entry to delete",
        )
        session.add(entry)
        await session.commit()
        entry_id = entry.id

    async with TestSessionLocal() as session:
        user_b = User(
            email="delB@example.com",
            display_name="Del B",
            supabase_uid="sb-del-b",
            workspace_id=ws_id,
        )
        session.add(user_b)
        await session.commit()
        user_b_id = user_b.id

    async def _override_b() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_b_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override_b

    response = await client.delete(f"/api/v1/diary/{entry_id}")
    assert response.status_code == 403

    app.dependency_overrides.pop(get_current_user, None)


# ── Streaks ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_streaks_empty(authed_client: AsyncClient) -> None:
    """GET /api/v1/diary/streaks should return 0 streak with no entries."""
    response = await authed_client.get("/api/v1/diary/streaks")
    assert response.status_code == 200
    data = response.json()
    assert len(data["streaks"]) == 1  # one member
    assert data["streaks"][0]["current_streak"] == 0
    assert data["streaks"][0]["logged_today"] is False


@pytest.mark.asyncio
async def test_streaks_logged_today(authed_client: AsyncClient) -> None:
    """Streak should show logged_today=True when entry exists for today."""
    await authed_client.post(
        "/api/v1/diary",
        json={
            "entry_date": date.today().isoformat(),
            "description": "Today's work",
        },
    )

    response = await authed_client.get("/api/v1/diary/streaks")
    data = response.json()
    assert data["streaks"][0]["logged_today"] is True
    assert data["streaks"][0]["current_streak"] == 1


@pytest.mark.asyncio
async def test_streaks_consecutive_days(authed_client: AsyncClient) -> None:
    """Three consecutive days should show a streak of 3."""
    today = date.today()
    for i in range(3):
        d = today - timedelta(days=i)
        await authed_client.post(
            "/api/v1/diary",
            json={"entry_date": d.isoformat(), "description": f"Day {i}"},
        )

    response = await authed_client.get("/api/v1/diary/streaks")
    data = response.json()
    assert data["streaks"][0]["current_streak"] == 3


# ── Auth edge cases ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_diary_without_auth_returns_403(client: AsyncClient) -> None:
    """GET /api/v1/diary without token should return 403."""
    response = await client.get("/api/v1/diary")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_entry_no_workspace(
    authed_client_no_workspace: AsyncClient,
) -> None:
    """Creating an entry without a workspace should return 400."""
    response = await authed_client_no_workspace.post(
        "/api/v1/diary",
        json={
            "entry_date": date.today().isoformat(),
            "description": "No workspace",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_entry_missing_description(authed_client: AsyncClient) -> None:
    """Missing description should return 422."""
    response = await authed_client.post(
        "/api/v1/diary",
        json={"entry_date": date.today().isoformat()},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_diary_entry_repr(client: AsyncClient) -> None:
    """DiaryEntry.__repr__ should contain date and author_id."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr WS")
        session.add(ws)
        await session.flush()

        user = User(
            email="repr-diary@example.com",
            display_name="Repr",
            supabase_uid="sb-repr-diary-uid",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()

        entry = DiaryEntry(
            workspace_id=ws.id,
            author_id=user.id,
            entry_date=date.today(),
            description="Repr test",
        )
        session.add(entry)
        await session.flush()
        r = repr(entry)
        assert "DiaryEntry" in r
        assert str(date.today()) in r

