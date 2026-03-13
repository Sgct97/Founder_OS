"""Workspace management — list, create, switch, join."""

import logging
import secrets
import string
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember

logger = logging.getLogger(__name__)

INVITE_CODE_LENGTH = 8
INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_invite_code() -> str:
    return "".join(
        secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH)
    )


async def list_user_workspaces(
    db: AsyncSession, user: User
) -> list[dict]:
    """Return all workspaces the user is a member of."""
    result = await db.execute(
        select(WorkspaceMember, Workspace)
        .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
        .order_by(Workspace.created_at)
    )
    rows = result.all()
    return [
        {
            "id": ws.id,
            "name": ws.name,
            "invite_code": ws.invite_code,
            "role": member.role,
            "is_active": ws.id == user.workspace_id,
            "created_at": ws.created_at,
            "updated_at": ws.updated_at,
        }
        for member, ws in rows
    ]


async def create_workspace(
    db: AsyncSession, user: User, name: str
) -> tuple[Workspace, WorkspaceMember]:
    """Create a new workspace and make the user the owner.

    Automatically switches the user's active workspace to the new one.
    """
    workspace = Workspace(
        name=name,
        invite_code=_generate_invite_code(),
    )
    db.add(workspace)
    await db.flush()

    membership = WorkspaceMember(
        user_id=user.id,
        workspace_id=workspace.id,
        role="owner",
    )
    db.add(membership)

    user.workspace_id = workspace.id
    db.add(user)
    await db.flush()

    logger.info("Created workspace=%s for user=%s", workspace.id, user.id)
    return workspace, membership


async def switch_workspace(
    db: AsyncSession, user: User, workspace_id: uuid.UUID
) -> Workspace:
    """Switch the user's active workspace.

    Raises 403 if the user is not a member of the target workspace.
    """
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.workspace_id == workspace_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace",
        )

    ws_result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = ws_result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    user.workspace_id = workspace_id
    db.add(user)
    await db.flush()

    logger.info("User=%s switched to workspace=%s", user.id, workspace_id)
    return workspace


async def join_by_invite_code(
    db: AsyncSession, user: User, invite_code: str
) -> Workspace:
    """Join a workspace using an invite code (for existing authenticated users).

    Raises 404 if the invite code is invalid.
    Raises 409 if the user is already a member of the workspace.
    Automatically switches the user's active workspace to the joined one.
    """
    result = await db.execute(
        select(Workspace).where(Workspace.invite_code == invite_code)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.workspace_id == workspace.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        )

    membership = WorkspaceMember(
        user_id=user.id,
        workspace_id=workspace.id,
        role="member",
    )
    db.add(membership)

    user.workspace_id = workspace.id
    db.add(user)
    await db.flush()

    logger.info("User=%s joined workspace=%s via invite code", user.id, workspace.id)
    return workspace
