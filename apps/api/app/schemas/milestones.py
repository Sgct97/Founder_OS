"""Pydantic schemas for phase and milestone endpoints."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────


class MilestoneStatus(str, Enum):
    """Allowed statuses for a milestone."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


# ── Milestone Schemas ────────────────────────────────────────────


class MilestoneCreate(BaseModel):
    """Body for POST /phases/{id}/milestones."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    status: MilestoneStatus = MilestoneStatus.NOT_STARTED
    sort_order: int = Field(default=0, ge=0)


class MilestoneUpdate(BaseModel):
    """Body for PATCH /milestones/{id}."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: MilestoneStatus | None = None
    sort_order: int | None = Field(default=None, ge=0)


class MilestoneResponse(BaseModel):
    """Public representation of a milestone."""

    id: uuid.UUID
    phase_id: uuid.UUID
    title: str
    description: str | None
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Phase Schemas ────────────────────────────────────────────────


class PhaseCreate(BaseModel):
    """Body for POST /phases."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    sort_order: int = Field(default=0, ge=0)


class PhaseUpdate(BaseModel):
    """Body for PATCH /phases/{id}."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class PhaseResponse(BaseModel):
    """Public representation of a phase (without milestones)."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    description: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhaseWithMilestonesResponse(BaseModel):
    """Phase with nested milestones — used for the milestone board."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    description: str | None
    sort_order: int
    milestones: list[MilestoneResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

