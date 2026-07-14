"""Pydantic schemas for Project CRUD."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """Payload to create a project."""

    name: str = Field(..., min_length=1, max_length=255)
    brief: str | None = Field(default=None, max_length=50_000)
    github_url: str | None = Field(default=None, max_length=500)
    preview_url: str | None = Field(default=None, max_length=500)


class ProjectUpdate(BaseModel):
    """Partial update for a project."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    brief: str | None = Field(default=None, max_length=50_000)
    github_url: str | None = Field(default=None, max_length=500)
    preview_url: str | None = Field(default=None, max_length=500)


class ProjectResponse(BaseModel):
    """Project returned to clients."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    created_by: uuid.UUID
    name: str
    brief: str | None
    github_url: str | None
    preview_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
