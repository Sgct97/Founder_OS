"""Diary router — diary entry CRUD and streak endpoints."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.diary import (
    DiaryEntryCreate,
    DiaryEntryResponse,
    DiaryEntryUpdate,
    StreaksResponse,
)
from app.services import diary as diary_service

router = APIRouter()


def _require_workspace(user: CurrentUser) -> uuid.UUID:
    """Extract workspace_id from the current user, raising 400 if absent."""
    if user.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to a workspace",
        )
    return user.workspace_id


@router.get(
    "",
    response_model=list[DiaryEntryResponse],
    summary="List diary entries",
)
async def list_entries(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    author: uuid.UUID | None = Query(default=None, description="Filter by author ID"),
    milestone: uuid.UUID | None = Query(
        default=None, description="Filter by milestone ID"
    ),
    date_from: date | None = Query(
        default=None, alias="from", description="Start date (inclusive)"
    ),
    date_to: date | None = Query(
        default=None, alias="to", description="End date (inclusive)"
    ),
) -> list[DiaryEntryResponse]:
    """List diary entries for the workspace with optional filters."""
    workspace_id = _require_workspace(current_user)
    entries = await diary_service.list_entries(
        db, workspace_id, author_id=author, milestone_id=milestone,
        date_from=date_from, date_to=date_to,
    )
    return [DiaryEntryResponse.model_validate(e) for e in entries]


@router.post(
    "",
    response_model=DiaryEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a diary entry",
)
async def create_entry(
    payload: DiaryEntryCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DiaryEntryResponse:
    """Log a new accountability diary entry."""
    workspace_id = _require_workspace(current_user)
    entry = await diary_service.create_entry(
        db, workspace_id, current_user.id, payload
    )
    return DiaryEntryResponse.model_validate(entry)


@router.patch(
    "/{entry_id}",
    response_model=DiaryEntryResponse,
    summary="Update a diary entry",
)
async def update_entry(
    entry_id: uuid.UUID,
    payload: DiaryEntryUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DiaryEntryResponse:
    """Update a diary entry (only the author can edit)."""
    workspace_id = _require_workspace(current_user)
    entry = await diary_service.update_entry(
        db, entry_id, workspace_id, current_user.id, payload
    )
    return DiaryEntryResponse.model_validate(entry)


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a diary entry",
)
async def delete_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a diary entry (only the author can delete)."""
    workspace_id = _require_workspace(current_user)
    await diary_service.delete_entry(db, entry_id, workspace_id, current_user.id)


@router.get(
    "/streaks",
    response_model=StreaksResponse,
    summary="Get streak data for workspace members",
)
async def get_streaks(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreaksResponse:
    """Calculate and return streak data for all workspace members."""
    workspace_id = _require_workspace(current_user)
    streaks = await diary_service.get_streaks(db, workspace_id)
    return StreaksResponse(streaks=streaks)

