"""Projects router — client delivery jobs within a workspace."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import projects as project_service

router = APIRouter()


def _require_workspace(user: CurrentUser) -> uuid.UUID:
    if user.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to a workspace",
        )
    return user.workspace_id


@router.get(
    "/projects",
    response_model=list[ProjectResponse],
    summary="List projects in the current workspace",
)
async def list_projects(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ProjectResponse]:
    workspace_id = _require_workspace(current_user)
    rows = await project_service.list_projects(db, workspace_id)
    return [ProjectResponse.model_validate(p) for p in rows]


@router.post(
    "/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
)
async def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectResponse:
    workspace_id = _require_workspace(current_user)
    project = await project_service.create_project(
        db, workspace_id, current_user.id, payload
    )
    return ProjectResponse.model_validate(project)


@router.get(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Get a project",
)
async def get_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectResponse:
    workspace_id = _require_workspace(current_user)
    project = await project_service.get_project(db, project_id, workspace_id)
    return ProjectResponse.model_validate(project)


@router.patch(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Update a project",
)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectResponse:
    workspace_id = _require_workspace(current_user)
    project = await project_service.update_project(
        db, project_id, workspace_id, payload
    )
    return ProjectResponse.model_validate(project)


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
)
async def delete_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    workspace_id = _require_workspace(current_user)
    await project_service.delete_project(db, project_id, workspace_id)
