"""Pydantic schemas for diary entry endpoints."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────────


class DiaryEntryCreate(BaseModel):
    """Body for POST /diary."""

    entry_date: date
    milestone_id: uuid.UUID | None = None
    hours_worked: float | None = Field(default=None, ge=0, le=24)
    description: str = Field(..., min_length=1, max_length=10000)


class DiaryEntryUpdate(BaseModel):
    """Body for PATCH /diary/{id}."""

    entry_date: date | None = None
    milestone_id: uuid.UUID | None = None
    hours_worked: float | None = Field(default=None, ge=0, le=24)
    description: str | None = Field(default=None, min_length=1, max_length=10000)


# ── Response Schemas ─────────────────────────────────────────────


class DiaryAuthorResponse(BaseModel):
    """Minimal author info embedded in diary entries."""

    id: uuid.UUID
    display_name: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


class DiaryMilestoneResponse(BaseModel):
    """Minimal milestone info embedded in diary entries."""

    id: uuid.UUID
    title: str
    status: str

    model_config = {"from_attributes": True}


class DiaryEntryResponse(BaseModel):
    """Public representation of a diary entry."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    author: DiaryAuthorResponse
    milestone: DiaryMilestoneResponse | None
    entry_date: date
    hours_worked: float | None
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StreakInfo(BaseModel):
    """Streak data for a single workspace member."""

    user_id: uuid.UUID
    display_name: str
    current_streak: int
    logged_today: bool


class StreaksResponse(BaseModel):
    """Streak data for all workspace members."""

    streaks: list[StreakInfo]

