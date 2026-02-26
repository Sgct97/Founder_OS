"""Milestone service — CRUD operations for phases and milestones."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.milestone import Milestone
from app.models.phase import Phase
from app.schemas.milestones import (
    MilestoneCreate,
    MilestoneUpdate,
    PhaseCreate,
    PhaseUpdate,
)

logger = logging.getLogger(__name__)


# ── Phase operations ─────────────────────────────────────────────


async def list_phases(db: AsyncSession, workspace_id: uuid.UUID) -> list[Phase]:
    """List all phases for a workspace, ordered by sort_order.

    Args:
        db: Active database session.
        workspace_id: The workspace to list phases for.

    Returns:
        List of phases with nested milestones.
    """
    result = await db.execute(
        select(Phase)
        .where(Phase.workspace_id == workspace_id)
        .options(selectinload(Phase.milestones))
        .order_by(Phase.sort_order, Phase.created_at)
    )
    return list(result.scalars().all())


async def create_phase(
    db: AsyncSession, workspace_id: uuid.UUID, payload: PhaseCreate
) -> Phase:
    """Create a new phase in the workspace.

    Args:
        db: Active database session.
        workspace_id: The workspace to add the phase to.
        payload: Validated phase creation request.

    Returns:
        The newly created Phase.
    """
    phase = Phase(
        workspace_id=workspace_id,
        title=payload.title,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    db.add(phase)
    await db.flush()
    logger.info("Phase created: id=%s workspace=%s", phase.id, workspace_id)
    return phase


async def get_phase(
    db: AsyncSession, phase_id: uuid.UUID, workspace_id: uuid.UUID
) -> Phase:
    """Fetch a single phase by ID, scoped to the workspace.

    Args:
        db: Active database session.
        phase_id: The phase to retrieve.
        workspace_id: The workspace the phase must belong to.

    Returns:
        The Phase object.

    Raises:
        HTTPException 404: If the phase is not found or doesn't belong to the workspace.
    """
    result = await db.execute(
        select(Phase)
        .where(Phase.id == phase_id, Phase.workspace_id == workspace_id)
        .options(selectinload(Phase.milestones))
    )
    phase = result.scalar_one_or_none()
    if phase is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phase not found",
        )
    return phase


async def update_phase(
    db: AsyncSession,
    phase_id: uuid.UUID,
    workspace_id: uuid.UUID,
    payload: PhaseUpdate,
) -> Phase:
    """Update a phase's title, description, or sort_order.

    Args:
        db: Active database session.
        phase_id: The phase to update.
        workspace_id: The workspace the phase must belong to.
        payload: Fields to update (only non-None fields are applied).

    Returns:
        The updated Phase.
    """
    phase = await get_phase(db, phase_id, workspace_id)

    if payload.title is not None:
        phase.title = payload.title
    if payload.description is not None:
        phase.description = payload.description
    if payload.sort_order is not None:
        phase.sort_order = payload.sort_order

    db.add(phase)
    await db.flush()
    await db.refresh(phase)
    logger.info("Phase updated: id=%s", phase_id)
    return phase


async def delete_phase(
    db: AsyncSession, phase_id: uuid.UUID, workspace_id: uuid.UUID
) -> None:
    """Delete a phase and all its milestones (cascaded).

    Args:
        db: Active database session.
        phase_id: The phase to delete.
        workspace_id: The workspace the phase must belong to.
    """
    phase = await get_phase(db, phase_id, workspace_id)
    await db.delete(phase)
    await db.flush()
    logger.info("Phase deleted: id=%s", phase_id)


# ── Milestone operations ─────────────────────────────────────────


async def create_milestone(
    db: AsyncSession,
    phase_id: uuid.UUID,
    workspace_id: uuid.UUID,
    payload: MilestoneCreate,
) -> Milestone:
    """Create a new milestone within a phase.

    Args:
        db: Active database session.
        phase_id: The phase to add the milestone to.
        workspace_id: The workspace the phase must belong to.
        payload: Validated milestone creation request.

    Returns:
        The newly created Milestone.
    """
    # Verify the phase belongs to the workspace.
    await get_phase(db, phase_id, workspace_id)

    milestone = Milestone(
        phase_id=phase_id,
        title=payload.title,
        description=payload.description,
        notes=payload.notes,
        status=payload.status.value,
        sort_order=payload.sort_order,
    )
    db.add(milestone)
    await db.flush()
    logger.info("Milestone created: id=%s phase=%s", milestone.id, phase_id)
    return milestone


async def get_milestone(
    db: AsyncSession, milestone_id: uuid.UUID, workspace_id: uuid.UUID
) -> Milestone:
    """Fetch a single milestone scoped to the workspace.

    Args:
        db: Active database session.
        milestone_id: The milestone to retrieve.
        workspace_id: The workspace the milestone's phase must belong to.

    Returns:
        The Milestone object.

    Raises:
        HTTPException 404: If the milestone is not found in the workspace.
    """
    result = await db.execute(
        select(Milestone)
        .join(Phase, Milestone.phase_id == Phase.id)
        .where(Milestone.id == milestone_id, Phase.workspace_id == workspace_id)
    )
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )
    return milestone


async def update_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    workspace_id: uuid.UUID,
    payload: MilestoneUpdate,
) -> Milestone:
    """Update a milestone's title, description, status, or sort_order.

    Args:
        db: Active database session.
        milestone_id: The milestone to update.
        workspace_id: The workspace the milestone's phase must belong to.
        payload: Fields to update (only non-None fields are applied).

    Returns:
        The updated Milestone.
    """
    milestone = await get_milestone(db, milestone_id, workspace_id)

    if payload.title is not None:
        milestone.title = payload.title
    if payload.description is not None:
        milestone.description = payload.description
    if payload.notes is not None:
        milestone.notes = payload.notes
    if payload.status is not None:
        milestone.status = payload.status.value
    if payload.sort_order is not None:
        milestone.sort_order = payload.sort_order

    db.add(milestone)
    await db.flush()
    await db.refresh(milestone)
    logger.info("Milestone updated: id=%s status=%s", milestone_id, milestone.status)
    return milestone


async def delete_milestone(
    db: AsyncSession, milestone_id: uuid.UUID, workspace_id: uuid.UUID
) -> None:
    """Delete a milestone.

    Args:
        db: Active database session.
        milestone_id: The milestone to delete.
        workspace_id: The workspace the milestone's phase must belong to.
    """
    milestone = await get_milestone(db, milestone_id, workspace_id)
    await db.delete(milestone)
    await db.flush()
    logger.info("Milestone deleted: id=%s", milestone_id)

