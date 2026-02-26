"""Auth service — user signup, login, workspace creation, invite codes."""

import logging
import secrets
import string

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.auth import (
    JoinWorkspaceRequest,
    LoginRequest,
    SignupRequest,
)

logger = logging.getLogger(__name__)

INVITE_CODE_LENGTH = 8
INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_invite_code() -> str:
    """Generate a short, URL-safe invite code (e.g. 'A7KX3BN2')."""
    return "".join(
        secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH)
    )


async def signup(db: AsyncSession, payload: SignupRequest) -> tuple[User, Workspace]:
    """Create a new workspace and its first user.

    Args:
        db: Active database session.
        payload: Validated signup request body.

    Returns:
        The newly created (User, Workspace) pair.

    Raises:
        HTTPException 409: If the email or supabase_uid is already registered.
    """
    # Check for duplicate email.
    existing = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Check for duplicate supabase_uid.
    existing_uid = await db.execute(
        select(User).where(User.supabase_uid == payload.supabase_uid)
    )
    if existing_uid.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this Supabase UID already exists",
        )

    # Create workspace.
    workspace = Workspace(
        name=payload.workspace_name,
        invite_code=_generate_invite_code(),
    )
    db.add(workspace)
    await db.flush()  # Populate workspace.id before FK reference.

    # Create user.
    user = User(
        email=payload.email,
        display_name=payload.display_name,
        supabase_uid=payload.supabase_uid,
        workspace_id=workspace.id,
    )
    db.add(user)
    await db.flush()

    logger.info("Signup: user=%s workspace=%s", user.id, workspace.id)
    return user, workspace


async def login(db: AsyncSession, payload: LoginRequest) -> tuple[User, Workspace]:
    """Look up an existing user by their Supabase UID.

    If the user has a valid Supabase account but doesn't exist in our DB
    (e.g. after a DB reset), they are auto-provisioned with a new workspace.
    This makes the login flow resilient to database resets during development.

    Args:
        db: Active database session.
        payload: Validated login request body.

    Returns:
        The (User, Workspace) pair.

    Raises:
        HTTPException 404: If user not found and no email was provided to
            auto-provision.
    """
    result = await db.execute(
        select(User).where(User.supabase_uid == payload.supabase_uid)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Auto-provision: create the user + workspace if we have their email.
        if not payload.email:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found — please sign up first",
            )

        logger.info(
            "Auto-provisioning user for supabase_uid=%s email=%s",
            payload.supabase_uid,
            payload.email,
        )

        # Check if email already exists (edge case: different Supabase UID).
        existing_email = await db.execute(
            select(User).where(User.email == payload.email)
        )
        if existing_email.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

        workspace = Workspace(
            name=f"{payload.email.split('@')[0]}'s Workspace",
            invite_code=_generate_invite_code(),
        )
        db.add(workspace)
        await db.flush()

        user = User(
            email=payload.email,
            display_name=payload.email.split("@")[0],
            supabase_uid=payload.supabase_uid,
            workspace_id=workspace.id,
        )
        db.add(user)
        await db.flush()

        return user, workspace

    workspace: Workspace | None = None
    if user.workspace_id is not None:
        ws_result = await db.execute(
            select(Workspace).where(Workspace.id == user.workspace_id)
        )
        workspace = ws_result.scalar_one_or_none()

    if workspace is None:
        # User exists but has no workspace — create one.
        workspace = Workspace(
            name=f"{user.display_name}'s Workspace",
            invite_code=_generate_invite_code(),
        )
        db.add(workspace)
        await db.flush()
        user.workspace_id = workspace.id
        db.add(user)
        await db.flush()

    return user, workspace


async def join_workspace(
    db: AsyncSession, payload: JoinWorkspaceRequest
) -> tuple[User, Workspace]:
    """Create a new user and add them to an existing workspace via invite code.

    Args:
        db: Active database session.
        payload: Validated join request body.

    Returns:
        The (User, Workspace) pair.

    Raises:
        HTTPException 404: If the invite code is invalid.
        HTTPException 409: If the email or UID is already registered.
    """
    # Look up workspace by invite code.
    ws_result = await db.execute(
        select(Workspace).where(Workspace.invite_code == payload.invite_code)
    )
    workspace = ws_result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    # Check for duplicate email.
    existing = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Check for duplicate supabase_uid.
    existing_uid = await db.execute(
        select(User).where(User.supabase_uid == payload.supabase_uid)
    )
    if existing_uid.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this Supabase UID already exists",
        )

    user = User(
        email=payload.email,
        display_name=payload.display_name,
        supabase_uid=payload.supabase_uid,
        workspace_id=workspace.id,
    )
    db.add(user)
    await db.flush()

    logger.info("Join: user=%s joined workspace=%s", user.id, workspace.id)
    return user, workspace


async def regenerate_invite_code(
    db: AsyncSession, workspace: Workspace
) -> str:
    """Generate a new invite code for the workspace.

    Args:
        db: Active database session.
        workspace: The workspace to regenerate the code for.

    Returns:
        The new invite code string.
    """
    new_code = _generate_invite_code()
    workspace.invite_code = new_code
    db.add(workspace)
    await db.flush()
    logger.info("Invite code regenerated for workspace=%s", workspace.id)
    return new_code

