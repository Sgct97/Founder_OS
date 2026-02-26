"""Pydantic schemas for authentication endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Request Schemas ──────────────────────────────────────────────


class SignupRequest(BaseModel):
    """Body for POST /auth/signup — create account + workspace."""

    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)
    workspace_name: str = Field(..., min_length=1, max_length=100)
    supabase_uid: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    """Body for POST /auth/login — exchange Supabase UID for user profile.

    If the user doesn't exist in our database but has a valid Supabase
    account, we auto-provision them using the email field.
    """

    supabase_uid: str = Field(..., min_length=1, max_length=255)
    email: EmailStr | None = Field(
        default=None,
        description="Email from Supabase Auth — used to auto-create the user if missing from DB.",
    )


class JoinWorkspaceRequest(BaseModel):
    """Body for POST /auth/join — join an existing workspace via invite code."""

    invite_code: str = Field(..., min_length=1, max_length=20)
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)
    supabase_uid: str = Field(..., min_length=1, max_length=255)


# ── Response Schemas ─────────────────────────────────────────────


class WorkspaceResponse(BaseModel):
    """Public representation of a workspace."""

    id: uuid.UUID
    name: str
    invite_code: str | None
    commitment_hours: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    """Public representation of a user."""

    id: uuid.UUID
    email: str
    display_name: str
    avatar_url: str | None
    workspace_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Combined user + workspace response returned after signup/login/join."""

    user: UserResponse
    workspace: WorkspaceResponse | None


class InviteResponse(BaseModel):
    """Response for POST /auth/invite — generated invite code."""

    invite_code: str

