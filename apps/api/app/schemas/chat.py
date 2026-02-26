"""Pydantic schemas for chat (RAG conversation) endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────────


class ConversationCreate(BaseModel):
    """Body for POST /conversations."""

    title: str = Field(default="New Conversation", min_length=1, max_length=255)


class MessageCreate(BaseModel):
    """Body for POST /conversations/{id}/messages."""

    content: str = Field(..., min_length=1, max_length=10000)


# ── Response Schemas ─────────────────────────────────────────────


class SourceCitation(BaseModel):
    """A source citation linking an AI response to a document chunk."""

    document_id: uuid.UUID
    document_title: str
    chunk_id: uuid.UUID
    snippet: str


class MessageResponse(BaseModel):
    """Public representation of a chat message."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    sources: list[SourceCitation] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Public representation of a conversation (without messages)."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    created_by: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetailResponse(BaseModel):
    """Conversation with its messages — used for the chat view."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    created_by: uuid.UUID
    title: str
    messages: list[MessageResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

