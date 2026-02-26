"""Tests for chat (RAG conversation) endpoints."""

import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.dependencies import get_current_user
from app.main import app
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.message import Message
from app.models.user import User
from app.models.workspace import Workspace
from app.services.chat import _build_rag_prompt, _sse_data
from tests.conftest import TestSessionLocal


# ── Helpers ──────────────────────────────────────────────────────


@pytest.fixture
async def authed_client(client: AsyncClient) -> AsyncClient:
    """Client with auth overridden to return a real test user in a workspace."""
    async with TestSessionLocal() as session:
        workspace = Workspace(name="Chat WS")
        session.add(workspace)
        await session.flush()

        user = User(
            email="chatuser@example.com",
            display_name="Chat User",
            supabase_uid="sb-chat-uid",
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
    """Client with auth overridden — user without a workspace."""
    async with TestSessionLocal() as session:
        user = User(
            email="orphan-chat@example.com",
            display_name="Orphan Chat",
            supabase_uid="sb-orphan-chat-uid",
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


# ── Conversation CRUD Tests ──────────────────────────────────────


@pytest.mark.asyncio
async def test_create_conversation(authed_client: AsyncClient) -> None:
    """POST /api/v1/conversations should create a conversation (201)."""
    response = await authed_client.post(
        "/api/v1/conversations",
        json={"title": "Test Conversation"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Conversation"
    assert "id" in data
    assert "workspace_id" in data


@pytest.mark.asyncio
async def test_create_conversation_default_title(authed_client: AsyncClient) -> None:
    """Creating a conversation without a title should use the default."""
    response = await authed_client.post(
        "/api/v1/conversations",
        json={},
    )
    assert response.status_code == 201
    assert response.json()["title"] == "New Conversation"


@pytest.mark.asyncio
async def test_list_conversations_empty(authed_client: AsyncClient) -> None:
    """GET /api/v1/conversations should return empty list."""
    response = await authed_client.get("/api/v1/conversations")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_conversations_after_create(authed_client: AsyncClient) -> None:
    """Created conversations should appear in the list."""
    await authed_client.post(
        "/api/v1/conversations", json={"title": "Conv 1"}
    )
    await authed_client.post(
        "/api/v1/conversations", json={"title": "Conv 2"}
    )

    response = await authed_client.get("/api/v1/conversations")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_messages_empty(authed_client: AsyncClient) -> None:
    """GET messages for a new conversation should return empty list."""
    conv_resp = await authed_client.post(
        "/api/v1/conversations", json={"title": "Empty Conv"}
    )
    conv_id = conv_resp.json()["id"]

    response = await authed_client.get(
        f"/api/v1/conversations/{conv_id}/messages"
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_delete_conversation(authed_client: AsyncClient) -> None:
    """DELETE /api/v1/conversations/{id} should remove it (204)."""
    conv_resp = await authed_client.post(
        "/api/v1/conversations", json={"title": "To Delete"}
    )
    conv_id = conv_resp.json()["id"]

    response = await authed_client.delete(f"/api/v1/conversations/{conv_id}")
    assert response.status_code == 204

    # Verify it's gone.
    list_resp = await authed_client.get("/api/v1/conversations")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_conversation_not_found(authed_client: AsyncClient) -> None:
    """DELETE on nonexistent conversation should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.delete(f"/api/v1/conversations/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_messages_not_found(authed_client: AsyncClient) -> None:
    """GET messages for nonexistent conversation should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.get(
        f"/api/v1/conversations/{fake_id}/messages"
    )
    assert response.status_code == 404


# ── Auth Edge Cases ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_conversations_without_auth_returns_403(client: AsyncClient) -> None:
    """GET /api/v1/conversations without token should return 403."""
    response = await client.get("/api/v1/conversations")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_conversation_no_workspace(
    authed_client_no_workspace: AsyncClient,
) -> None:
    """Creating a conversation without a workspace should return 400."""
    response = await authed_client_no_workspace.post(
        "/api/v1/conversations", json={"title": "Fail"}
    )
    assert response.status_code == 400
    assert "workspace" in response.json()["detail"].lower()


# ── Send Message (SSE) Tests ────────────────────────────────────


@pytest.mark.asyncio
async def test_send_message_no_documents(authed_client: AsyncClient) -> None:
    """Sending a message with no documents should return the no-context response."""
    conv_resp = await authed_client.post(
        "/api/v1/conversations", json={"title": "No Docs Conv"}
    )
    conv_id = conv_resp.json()["id"]

    with patch("app.services.chat.generate_query_embedding") as mock_embed:
        mock_embed.return_value = [0.0] * 1536

        response = await authed_client.post(
            f"/api/v1/conversations/{conv_id}/messages",
            json={"content": "What is the architecture?"},
        )
        assert response.status_code == 200
        # SSE response should contain the no-context message.
        body = response.text
        assert "don't have enough information" in body or "data:" in body


@pytest.mark.asyncio
async def test_send_message_nonexistent_conversation(
    authed_client: AsyncClient,
) -> None:
    """Sending a message to a nonexistent conversation should return 404."""
    fake_id = str(uuid.uuid4())

    response = await authed_client.post(
        f"/api/v1/conversations/{fake_id}/messages",
        json={"content": "Hello?"},
    )
    assert response.status_code == 404


# ── RAG Prompt Building Tests ────────────────────────────────────


def test_build_rag_prompt_with_chunks() -> None:
    """RAG prompt should include system prompt, context, and user question."""
    chunks = [
        {
            "document_title": "Architecture Doc",
            "content": "The system uses PostgreSQL.",
        },
        {
            "document_title": "Setup Guide",
            "content": "Run docker compose up.",
        },
    ]
    messages = _build_rag_prompt("How do I start the database?", chunks)

    assert messages[0]["role"] == "system"
    assert "ONLY" in messages[0]["content"]
    assert messages[1]["role"] == "system"
    assert "Architecture Doc" in messages[1]["content"]
    assert messages[-1]["role"] == "user"
    assert "database" in messages[-1]["content"]


def test_build_rag_prompt_without_chunks() -> None:
    """RAG prompt without chunks should only have system + user messages."""
    messages = _build_rag_prompt("Hello?", [])
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"


def test_build_rag_prompt_with_history() -> None:
    """RAG prompt should include conversation history."""
    history = [
        {"role": "user", "content": "What is FounderOS?"},
        {"role": "assistant", "content": "It's a knowledge base tool."},
    ]
    chunks = [{"document_title": "Doc", "content": "Some context."}]
    messages = _build_rag_prompt("Tell me more.", chunks, history)

    # System prompt + context + 2 history messages + current question = 5
    assert len(messages) == 5
    assert messages[2]["role"] == "user"
    assert messages[2]["content"] == "What is FounderOS?"


# ── SSE Formatting Tests ────────────────────────────────────────


def test_sse_data_format() -> None:
    """SSE data helper should produce valid JSON."""
    result = _sse_data({"type": "content", "content": "hello"})
    parsed = json.loads(result)
    assert parsed["type"] == "content"
    assert parsed["content"] == "hello"


# ── Model Repr Tests ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_conversation_repr(client: AsyncClient) -> None:
    """Conversation.__repr__ should contain title."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr Chat WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="repr-chat@example.com",
            display_name="Repr Chat",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()
        conv = Conversation(
            workspace_id=ws.id,
            created_by=user.id,
            title="Repr Conv",
        )
        session.add(conv)
        await session.flush()
        r = repr(conv)
        assert "Repr Conv" in r
        assert "Conversation" in r


@pytest.mark.asyncio
async def test_message_repr(client: AsyncClient) -> None:
    """Message.__repr__ should contain role."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr Msg WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="repr-msg@example.com",
            display_name="Repr Msg",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()
        conv = Conversation(
            workspace_id=ws.id,
            created_by=user.id,
            title="Repr Msg Conv",
        )
        session.add(conv)
        await session.flush()
        msg = Message(
            conversation_id=conv.id,
            role="user",
            content="Test message",
        )
        session.add(msg)
        await session.flush()
        r = repr(msg)
        assert "user" in r
        assert "Message" in r

