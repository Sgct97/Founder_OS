"""Workspace settings router — API key management and project brief."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.workspace_settings import (
    ApiKeyCreate,
    ApiKeyResponse,
    ProjectBriefResponse,
    ProjectBriefUpdate,
)
from app.services import workspace_settings as settings_service

router = APIRouter()


def _require_workspace(user: CurrentUser) -> uuid.UUID:
    if user.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to a workspace",
        )
    return user.workspace_id


# ── API Keys ──────────────────────────────────────────────────────


@router.get(
    "/api-keys",
    response_model=list[ApiKeyResponse],
    summary="List configured API keys (masked)",
)
async def list_api_keys(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[ApiKeyResponse]:
    workspace_id = _require_workspace(user)
    keys = await settings_service.list_api_keys(db, workspace_id)
    return [
        ApiKeyResponse(
            id=str(k.id),
            service=k.service,
            key_hint=k.key_hint,
            label=k.label,
            added_by=str(k.added_by),
            created_at=k.created_at,
            updated_at=k.updated_at,
        )
        for k in keys
    ]


@router.post(
    "/api-keys",
    response_model=ApiKeyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an encrypted API key for a service",
)
async def add_api_key(
    body: ApiKeyCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ApiKeyResponse:
    workspace_id = _require_workspace(user)
    key = await settings_service.add_api_key(
        db,
        workspace_id=workspace_id,
        user_id=user.id,
        service=body.service,
        raw_key=body.api_key,
        label=body.label,
    )
    return ApiKeyResponse(
        id=str(key.id),
        service=key.service,
        key_hint=key.key_hint,
        label=key.label,
        added_by=str(key.added_by),
        created_at=key.created_at,
        updated_at=key.updated_at,
    )


@router.delete(
    "/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an API key",
)
async def delete_api_key(
    key_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    workspace_id = _require_workspace(user)
    await settings_service.delete_api_key(db, workspace_id, key_id)


# ── Project Brief ────────────────────────────────────────────────


@router.get(
    "/project-brief",
    response_model=ProjectBriefResponse,
    summary="Get the workspace project brief",
)
async def get_project_brief(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ProjectBriefResponse:
    workspace_id = _require_workspace(user)
    brief = await settings_service.get_project_brief(db, workspace_id)
    return ProjectBriefResponse(project_brief=brief)


@router.put(
    "/project-brief",
    response_model=ProjectBriefResponse,
    summary="Update the workspace project brief",
)
async def update_project_brief(
    body: ProjectBriefUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ProjectBriefResponse:
    workspace_id = _require_workspace(user)
    brief = await settings_service.update_project_brief(
        db, workspace_id, body.project_brief
    )
    return ProjectBriefResponse(project_brief=brief)
