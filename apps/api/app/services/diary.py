"""Diary service — CRUD operations for diary entries and streak calculation."""

import logging
import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.diary_entry import DiaryEntry
from app.models.milestone import Milestone
from app.models.phase import Phase
from app.models.user import User
from app.schemas.diary import (
    DiaryEntryCreate,
    DiaryEntryUpdate,
    StreakInfo,
)

logger = logging.getLogger(__name__)


async def list_entries(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    author_id: uuid.UUID | None = None,
    milestone_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[DiaryEntry]:
    """List diary entries for a workspace with optional filters.

    Args:
        db: Active database session.
        workspace_id: Scope entries to this workspace.
        author_id: Optional filter by author.
        milestone_id: Optional filter by linked milestone.
        date_from: Optional start date (inclusive).
        date_to: Optional end date (inclusive).

    Returns:
        List of diary entries in reverse chronological order.
    """
    query = (
        select(DiaryEntry)
        .where(DiaryEntry.workspace_id == workspace_id)
        .options(
            selectinload(DiaryEntry.author),
            selectinload(DiaryEntry.milestone),
        )
        .order_by(DiaryEntry.entry_date.desc(), DiaryEntry.created_at.desc())
    )

    if author_id is not None:
        query = query.where(DiaryEntry.author_id == author_id)
    if milestone_id is not None:
        query = query.where(DiaryEntry.milestone_id == milestone_id)
    if date_from is not None:
        query = query.where(DiaryEntry.entry_date >= date_from)
    if date_to is not None:
        query = query.where(DiaryEntry.entry_date <= date_to)

    result = await db.execute(query)
    return list(result.scalars().all())


async def create_entry(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    author_id: uuid.UUID,
    payload: DiaryEntryCreate,
) -> DiaryEntry:
    """Create a new diary entry.

    Args:
        db: Active database session.
        workspace_id: The workspace for the entry.
        author_id: The user creating the entry.
        payload: Validated diary entry creation request.

    Returns:
        The newly created DiaryEntry.

    Raises:
        HTTPException 404: If the linked milestone doesn't exist in the workspace.
    """
    # Validate milestone reference if provided.
    if payload.milestone_id is not None:
        ms_result = await db.execute(
            select(Milestone)
            .join(Phase, Milestone.phase_id == Phase.id)
            .where(
                Milestone.id == payload.milestone_id,
                Phase.workspace_id == workspace_id,
            )
        )
        if ms_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Linked milestone not found in this workspace",
            )

    entry = DiaryEntry(
        workspace_id=workspace_id,
        author_id=author_id,
        milestone_id=payload.milestone_id,
        entry_date=payload.entry_date,
        hours_worked=payload.hours_worked,
        description=payload.description,
    )
    db.add(entry)
    await db.flush()

    # Reload relationships so the response includes author and milestone.
    await db.refresh(entry, attribute_names=["author", "milestone"])

    logger.info("Diary entry created: id=%s author=%s", entry.id, author_id)
    return entry


async def get_entry(
    db: AsyncSession, entry_id: uuid.UUID, workspace_id: uuid.UUID
) -> DiaryEntry:
    """Fetch a single diary entry scoped to a workspace.

    Args:
        db: Active database session.
        entry_id: The entry to retrieve.
        workspace_id: The workspace the entry must belong to.

    Returns:
        The DiaryEntry object.

    Raises:
        HTTPException 404: If the entry is not found.
    """
    result = await db.execute(
        select(DiaryEntry)
        .where(DiaryEntry.id == entry_id, DiaryEntry.workspace_id == workspace_id)
        .options(
            selectinload(DiaryEntry.author),
            selectinload(DiaryEntry.milestone),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diary entry not found",
        )
    return entry


async def update_entry(
    db: AsyncSession,
    entry_id: uuid.UUID,
    workspace_id: uuid.UUID,
    author_id: uuid.UUID,
    payload: DiaryEntryUpdate,
) -> DiaryEntry:
    """Update a diary entry (only the author can edit their own entries).

    Args:
        db: Active database session.
        entry_id: The entry to update.
        workspace_id: The workspace the entry must belong to.
        author_id: The user requesting the update (must be the author).
        payload: Fields to update (only non-None fields are applied).

    Returns:
        The updated DiaryEntry.

    Raises:
        HTTPException 403: If the user is not the entry's author.
    """
    entry = await get_entry(db, entry_id, workspace_id)

    if entry.author_id != author_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own diary entries",
        )

    if payload.entry_date is not None:
        entry.entry_date = payload.entry_date
    if payload.description is not None:
        entry.description = payload.description
    if payload.hours_worked is not None:
        entry.hours_worked = payload.hours_worked
    # milestone_id can be explicitly set to None (unlink) or to a new UUID.
    if "milestone_id" in payload.model_fields_set:
        entry.milestone_id = payload.milestone_id

    db.add(entry)
    await db.flush()
    await db.refresh(entry)

    logger.info("Diary entry updated: id=%s", entry_id)
    return entry


async def delete_entry(
    db: AsyncSession,
    entry_id: uuid.UUID,
    workspace_id: uuid.UUID,
    author_id: uuid.UUID,
) -> None:
    """Delete a diary entry (only the author can delete their own entries).

    Args:
        db: Active database session.
        entry_id: The entry to delete.
        workspace_id: The workspace the entry must belong to.
        author_id: The user requesting the deletion (must be the author).

    Raises:
        HTTPException 403: If the user is not the entry's author.
    """
    entry = await get_entry(db, entry_id, workspace_id)

    if entry.author_id != author_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own diary entries",
        )

    await db.delete(entry)
    await db.flush()
    logger.info("Diary entry deleted: id=%s", entry_id)


async def get_streaks(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[StreakInfo]:
    """Calculate streak data for all members of a workspace.

    A streak is the number of consecutive days (ending today or yesterday)
    that a user has logged at least one diary entry.

    Args:
        db: Active database session.
        workspace_id: The workspace to calculate streaks for.

    Returns:
        List of StreakInfo for each workspace member.
    """
    # Get all workspace members.
    members_result = await db.execute(
        select(User).where(User.workspace_id == workspace_id)
    )
    members = list(members_result.scalars().all())

    today = date.today()
    streaks: list[StreakInfo] = []

    for member in members:
        # Get distinct entry dates for this user, ordered descending.
        dates_result = await db.execute(
            select(func.distinct(DiaryEntry.entry_date))
            .where(
                DiaryEntry.workspace_id == workspace_id,
                DiaryEntry.author_id == member.id,
            )
            .order_by(DiaryEntry.entry_date.desc())
        )
        entry_dates = [row[0] for row in dates_result.all()]

        logged_today = today in entry_dates

        # Calculate consecutive streak.
        streak_count = 0
        check_date = today

        # If they didn't log today, start counting from yesterday.
        if not logged_today and entry_dates and entry_dates[0] == today - timedelta(days=1):
            check_date = today - timedelta(days=1)
        elif not logged_today:
            streaks.append(
                StreakInfo(
                    user_id=member.id,
                    display_name=member.display_name,
                    current_streak=0,
                    logged_today=False,
                )
            )
            continue

        for entry_date in entry_dates:
            if entry_date == check_date:
                streak_count += 1
                check_date -= timedelta(days=1)
            elif entry_date < check_date:
                break

        streaks.append(
            StreakInfo(
                user_id=member.id,
                display_name=member.display_name,
                current_streak=streak_count,
                logged_today=logged_today,
            )
        )

    return streaks

