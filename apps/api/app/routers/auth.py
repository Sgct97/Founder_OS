"""Auth router — signup, login, invite, join workspace."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, VerifiedSupabaseUid
from app.schemas.auth import (
    AuthResponse,
    InviteResponse,
    JoinWorkspaceRequest,
    LoginRequest,
    SignupRequest,
    UserResponse,
    WorkspaceResponse,
)
from app.services import auth as auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create account and workspace",
)
async def signup(
    payload: SignupRequest,
    verified_uid: VerifiedSupabaseUid,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Register a new user, create a workspace, and return both.

    The supabase_uid is extracted from the verified JWT — the value
    in the request body is ignored to prevent spoofing.
    """
    payload.supabase_uid = verified_uid
    user, workspace = await auth_service.signup(db, payload)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        workspace=WorkspaceResponse.model_validate(workspace),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Get user profile by Supabase UID",
)
async def login(
    payload: LoginRequest,
    verified_uid: VerifiedSupabaseUid,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Look up an existing user by verified Supabase UID and return their profile."""
    payload.supabase_uid = verified_uid
    user, workspace = await auth_service.login(db, payload)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        workspace=WorkspaceResponse.model_validate(workspace) if workspace else None,
    )


@router.post(
    "/join",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Join workspace via invite code",
)
async def join_workspace(
    payload: JoinWorkspaceRequest,
    verified_uid: VerifiedSupabaseUid,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Create a new user and add them to a workspace using an invite code.

    The supabase_uid is extracted from the verified JWT.
    """
    payload.supabase_uid = verified_uid
    user, workspace = await auth_service.join_workspace(db, payload)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        workspace=WorkspaceResponse.model_validate(workspace),
    )


@router.post(
    "/invite",
    response_model=InviteResponse,
    summary="Regenerate workspace invite code",
)
async def regenerate_invite(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InviteResponse:
    """Generate a new invite code for the current user's workspace.

    Only owners and admins may regenerate invite codes.
    """
    from fastapi import HTTPException
    from sqlalchemy import select
    from app.models.workspace_member import WorkspaceMember

    if current_user.workspace is None:
        raise HTTPException(
            status_code=400,
            detail="User does not belong to a workspace",
        )

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.workspace_id == current_user.workspace_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None or membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can regenerate invite codes",
        )

    new_code = await auth_service.regenerate_invite_code(db, current_user.workspace)
    return InviteResponse(invite_code=new_code)


@router.post(
    "/complete-tour",
    response_model=UserResponse,
    summary="Mark the onboarding tour as completed",
)
async def complete_tour(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Set has_completed_tour=true for the authenticated user."""
    current_user.has_completed_tour = True
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    logger.info("Tour completed for user=%s", current_user.id)
    return UserResponse.model_validate(current_user)


@router.get(
    "/me",
    response_model=AuthResponse,
    summary="Get current user profile",
)
async def get_me(current_user: CurrentUser) -> AuthResponse:
    """Return the authenticated user's profile and workspace."""
    return AuthResponse(
        user=UserResponse.model_validate(current_user),
        workspace=WorkspaceResponse.model_validate(current_user.workspace)
        if current_user.workspace
        else None,
    )

