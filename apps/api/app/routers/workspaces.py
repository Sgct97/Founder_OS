"""Workspaces router — list, create, switch workspaces."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.auth import (
    CreateWorkspaceRequest,
    JoinByInviteRequest,
    SwitchWorkspaceRequest,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from app.services import workspaces as ws_service

router = APIRouter()


@router.get(
    "",
    response_model=list[WorkspaceMemberResponse],
    summary="List workspaces the user belongs to",
)
async def list_workspaces(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkspaceMemberResponse]:
    rows = await ws_service.list_user_workspaces(db, current_user)
    return [WorkspaceMemberResponse(**r) for r in rows]


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new workspace",
)
async def create_workspace(
    payload: CreateWorkspaceRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceResponse:
    workspace, _ = await ws_service.create_workspace(db, current_user, payload.name)
    return WorkspaceResponse.model_validate(workspace)


@router.put(
    "/switch",
    response_model=WorkspaceResponse,
    summary="Switch active workspace",
)
async def switch_workspace(
    payload: SwitchWorkspaceRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceResponse:
    workspace = await ws_service.switch_workspace(db, current_user, payload.workspace_id)
    return WorkspaceResponse.model_validate(workspace)


@router.post(
    "/join",
    response_model=WorkspaceResponse,
    summary="Join a workspace via invite code (existing user)",
)
async def join_workspace(
    payload: JoinByInviteRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceResponse:
    workspace = await ws_service.join_by_invite_code(db, current_user, payload.invite_code)
    return WorkspaceResponse.model_validate(workspace)
