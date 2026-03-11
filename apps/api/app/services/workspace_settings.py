"""Workspace settings service — API key management and project brief."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import Workspace
from app.models.workspace_api_key import WorkspaceApiKey
from app.utils.encryption import decrypt, encrypt, mask_key

logger = logging.getLogger(__name__)


# ── API Key CRUD ──────────────────────────────────────────────────


async def list_api_keys(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[WorkspaceApiKey]:
    """List all API keys for a workspace (encrypted_key is never exposed via schema)."""
    result = await db.execute(
        select(WorkspaceApiKey)
        .where(WorkspaceApiKey.workspace_id == workspace_id)
        .order_by(WorkspaceApiKey.service, WorkspaceApiKey.created_at)
    )
    return list(result.scalars().all())


async def add_api_key(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    service: str,
    raw_key: str,
    label: str | None = None,
) -> WorkspaceApiKey:
    """Encrypt and store a new API key for a workspace.

    Enforces one key per service per workspace (upsert behavior).
    """
    service_lower = service.lower().strip()

    existing = await db.execute(
        select(WorkspaceApiKey).where(
            WorkspaceApiKey.workspace_id == workspace_id,
            WorkspaceApiKey.service == service_lower,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A key for '{service_lower}' already exists. Delete it first to replace.",
        )

    encrypted = encrypt(raw_key)
    hint = mask_key(raw_key)

    api_key = WorkspaceApiKey(
        workspace_id=workspace_id,
        service=service_lower,
        encrypted_key=encrypted,
        key_hint=hint,
        label=label,
        added_by=user_id,
    )
    db.add(api_key)
    await db.flush()
    logger.info(
        "API key added: service=%s workspace=%s hint=%s",
        service_lower, workspace_id, hint,
    )
    return api_key


async def delete_api_key(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    key_id: uuid.UUID,
) -> None:
    """Delete an API key from a workspace."""
    result = await db.execute(
        select(WorkspaceApiKey).where(
            WorkspaceApiKey.id == key_id,
            WorkspaceApiKey.workspace_id == workspace_id,
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    await db.delete(api_key)
    await db.flush()
    logger.info("API key deleted: id=%s service=%s", key_id, api_key.service)


# ── Key Resolution (used by AI services) ─────────────────────────


async def get_openai_api_key(
    db: AsyncSession, workspace_id: uuid.UUID
) -> str | None:
    """Resolve the OpenAI API key from the workspace's encrypted store.

    Returns None if the workspace has not configured a key.
    There is no server-side fallback — each workspace must provide its own key.
    """
    result = await db.execute(
        select(WorkspaceApiKey).where(
            WorkspaceApiKey.workspace_id == workspace_id,
            WorkspaceApiKey.service == "openai",
        )
    )
    workspace_key = result.scalar_one_or_none()

    if workspace_key is not None:
        try:
            return decrypt(workspace_key.encrypted_key)
        except Exception:
            logger.exception(
                "Failed to decrypt OpenAI key for workspace=%s",
                workspace_id,
            )

    return None


# ── Project Brief ────────────────────────────────────────────────


async def get_project_brief(
    db: AsyncSession, workspace_id: uuid.UUID
) -> str | None:
    """Get the project brief for a workspace."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    return workspace.project_brief


async def update_project_brief(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    project_brief: str | None,
) -> str | None:
    """Update the project brief for a workspace."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    workspace.project_brief = project_brief
    db.add(workspace)
    await db.flush()
    logger.info("Project brief updated: workspace=%s length=%d", workspace_id, len(project_brief or ""))
    return workspace.project_brief
