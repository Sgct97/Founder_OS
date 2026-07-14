"""Project service — workspace-scoped CRUD."""

from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.projects import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)


async def list_projects(db: AsyncSession, workspace_id: uuid.UUID) -> list[Project]:
    """Return all projects in a workspace, newest first."""
    result = await db.execute(
        select(Project)
        .where(Project.workspace_id == workspace_id)
        .order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


async def get_project(
    db: AsyncSession, project_id: uuid.UUID, workspace_id: uuid.UUID
) -> Project:
    """Fetch a project by id, scoped to workspace. Raises 404 if missing."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.workspace_id == workspace_id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def create_project(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: ProjectCreate,
) -> Project:
    """Create a project in the given workspace."""
    project = Project(
        workspace_id=workspace_id,
        created_by=user_id,
        name=payload.name.strip(),
        brief=payload.brief,
        github_url=payload.github_url,
        preview_url=payload.preview_url,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    logger.info("Project created: id=%s workspace=%s", project.id, workspace_id)
    return project


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    workspace_id: uuid.UUID,
    payload: ProjectUpdate,
) -> Project:
    """Update project fields. Only provided fields are changed."""
    project = await get_project(db, project_id, workspace_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for key, value in data.items():
        setattr(project, key, value)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(
    db: AsyncSession, project_id: uuid.UUID, workspace_id: uuid.UUID
) -> None:
    """Delete a project scoped to the workspace."""
    project = await get_project(db, project_id, workspace_id)
    await db.delete(project)
    await db.commit()
    logger.info("Project deleted: id=%s workspace=%s", project_id, workspace_id)
