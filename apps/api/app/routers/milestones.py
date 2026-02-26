"""Milestone router — phase and milestone CRUD endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.milestones import (
    MilestoneCreate,
    MilestoneImportPreview,
    MilestoneImportRequest,
    MilestoneImportResponse,
    MilestoneResponse,
    MilestoneUpdate,
    PhaseCreate,
    PhaseResponse,
    PhaseUpdate,
    PhaseWithMilestonesResponse,
)
from app.services import milestones as milestones_service
from app.services.milestone_import import create_phases_from_preview, parse_text_with_ai

router = APIRouter()


def _require_workspace(user: CurrentUser) -> uuid.UUID:
    """Extract workspace_id from the current user, raising 400 if absent."""
    if user.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to a workspace",
        )
    return user.workspace_id


# ── Phase endpoints ──────────────────────────────────────────────


@router.get(
    "/phases",
    response_model=list[PhaseWithMilestonesResponse],
    summary="List all phases with milestones",
)
async def list_phases(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PhaseWithMilestonesResponse]:
    """Return all phases for the user's workspace with nested milestones."""
    workspace_id = _require_workspace(current_user)
    phases = await milestones_service.list_phases(db, workspace_id)
    return [PhaseWithMilestonesResponse.model_validate(p) for p in phases]


@router.post(
    "/phases",
    response_model=PhaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new phase",
)
async def create_phase(
    payload: PhaseCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PhaseResponse:
    """Create a new phase in the user's workspace."""
    workspace_id = _require_workspace(current_user)
    phase = await milestones_service.create_phase(db, workspace_id, payload)
    return PhaseResponse.model_validate(phase)


@router.patch(
    "/phases/{phase_id}",
    response_model=PhaseResponse,
    summary="Update a phase",
)
async def update_phase(
    phase_id: uuid.UUID,
    payload: PhaseUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PhaseResponse:
    """Update a phase's title, description, or sort order."""
    workspace_id = _require_workspace(current_user)
    phase = await milestones_service.update_phase(db, phase_id, workspace_id, payload)
    return PhaseResponse.model_validate(phase)


@router.delete(
    "/phases/{phase_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a phase",
)
async def delete_phase(
    phase_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a phase and all its milestones."""
    workspace_id = _require_workspace(current_user)
    await milestones_service.delete_phase(db, phase_id, workspace_id)


# ── Milestone endpoints ──────────────────────────────────────────


@router.post(
    "/phases/{phase_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a milestone in a phase",
)
async def create_milestone(
    phase_id: uuid.UUID,
    payload: MilestoneCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MilestoneResponse:
    """Add a new milestone to the specified phase."""
    workspace_id = _require_workspace(current_user)
    milestone = await milestones_service.create_milestone(
        db, phase_id, workspace_id, payload
    )
    return MilestoneResponse.model_validate(milestone)


@router.patch(
    "/milestones/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Update a milestone",
)
async def update_milestone(
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MilestoneResponse:
    """Update a milestone's title, description, status, or sort order."""
    workspace_id = _require_workspace(current_user)
    milestone = await milestones_service.update_milestone(
        db, milestone_id, workspace_id, payload
    )
    return MilestoneResponse.model_validate(milestone)


@router.delete(
    "/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a milestone",
)
async def delete_milestone(
    milestone_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a milestone."""
    workspace_id = _require_workspace(current_user)
    await milestones_service.delete_milestone(db, milestone_id, workspace_id)


# ── Import endpoints ─────────────────────────────────────────────


@router.post(
    "/phases/import/preview",
    response_model=MilestoneImportPreview,
    summary="Preview milestone import — parse text with AI",
)
async def import_preview(
    payload: MilestoneImportRequest,
    current_user: CurrentUser,
) -> MilestoneImportPreview:
    """Send raw text to GPT-5.2 and return a structured preview of phases
    and milestones before committing anything to the database."""
    _require_workspace(current_user)
    return await parse_text_with_ai(payload.content)


@router.post(
    "/phases/import/confirm",
    response_model=MilestoneImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm and save imported milestones",
)
async def import_confirm(
    payload: MilestoneImportRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MilestoneImportResponse:
    """Parse the text again and save the resulting phases/milestones to
    the database. Use `replace_existing=true` to clear all current phases."""
    workspace_id = _require_workspace(current_user)
    preview = await parse_text_with_ai(payload.content)
    phases = await create_phases_from_preview(
        db, workspace_id, preview, payload.replace_existing
    )
    return MilestoneImportResponse(
        phases_created=len(phases),
        milestones_created=sum(len(p.milestones) for p in phases),
        phases=[PhaseWithMilestonesResponse.model_validate(p) for p in phases],
    )

