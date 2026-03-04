"""Pydantic schemas for feature request endpoints."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class FeatureRequestStatus(str, Enum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"


class FeatureRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)


class FeatureRequestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: FeatureRequestStatus | None = None


class VoterInfo(BaseModel):
    user_id: uuid.UUID
    email: str | None = None
    display_name: str | None = None

    model_config = {"from_attributes": True}


class FeatureRequestResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    author_id: uuid.UUID
    author_email: str | None = None
    author_name: str | None = None
    title: str
    description: str | None
    status: str
    vote_count: int
    has_voted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
