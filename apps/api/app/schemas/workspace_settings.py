"""Schemas for workspace settings — API keys and project brief."""

from datetime import datetime

from pydantic import BaseModel, Field


# ── API Keys ──────────────────────────────────────────────────────


class ApiKeyCreate(BaseModel):
    """Payload to add a new API key for a service."""

    service: str = Field(
        ..., min_length=1, max_length=50,
        description="Service identifier, e.g. 'openai', 'anthropic'",
    )
    api_key: str = Field(
        ..., min_length=5, max_length=500,
        description="The raw API key — encrypted before storage, never returned",
    )
    label: str | None = Field(
        None, max_length=100,
        description="Optional label like 'Production key'",
    )


class ApiKeyResponse(BaseModel):
    """API key metadata returned to the client. Never includes the raw key."""

    id: str
    service: str
    key_hint: str
    label: str | None
    added_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Project Brief ────────────────────────────────────────────────


class ProjectBriefUpdate(BaseModel):
    """Payload to update the workspace's project brief."""

    project_brief: str | None = Field(
        None, max_length=50000,
        description="Project description for AI context (max 50k chars). Set to null to clear.",
    )


class ProjectBriefResponse(BaseModel):
    """Current project brief for a workspace."""

    project_brief: str | None

    model_config = {"from_attributes": True}
