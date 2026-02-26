"""Auth router — signup, login, invite, join workspace."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
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

router = APIRouter()


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create account and workspace",
)
async def signup(
    payload: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Register a new user, create a workspace, and return both."""
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
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Look up an existing user by Supabase UID and return their profile."""
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
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Create a new user and add them to a workspace using an invite code."""
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

    Requires authentication.
    """
    if current_user.workspace is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail="User does not belong to a workspace",
        )
    new_code = await auth_service.regenerate_invite_code(db, current_user.workspace)
    return InviteResponse(invite_code=new_code)


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

