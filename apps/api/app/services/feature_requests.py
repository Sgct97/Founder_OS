"""Feature request service — CRUD + voting operations."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.feature_request import FeatureRequest, FeatureVote
from app.schemas.feature_requests import (
    FeatureRequestCreate,
    FeatureRequestUpdate,
)

logger = logging.getLogger(__name__)

# ── Seed data for new workspaces ─────────────────────────────────
MOCK_FEATURE_REQUESTS: list[dict] = [
    {
        "title": "Dark mode / theme toggle",
        "description": "Allow users to switch between light and dark themes. Many users prefer dark mode for late-night work sessions.",
        "status": "open",
        "vote_count": 5,
    },
    {
        "title": "Calendar view for milestones",
        "description": "Add an optional calendar visualization so founders can see milestone deadlines and diary entries mapped to dates.",
        "status": "under_review",
        "vote_count": 3,
    },
    {
        "title": "Export milestone map as PDF",
        "description": "Let users export their entire milestone roadmap as a shareable PDF for investor decks or team presentations.",
        "status": "planned",
        "vote_count": 2,
    },
]


async def seed_mock_feature_requests(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    author_id: uuid.UUID,
) -> None:
    """Populate a brand-new workspace with sample feature requests.

    Called exactly once during signup/auto-provision. Never touches
    existing workspaces because it is only invoked in the new-workspace
    code path.
    """
    for fr_data in MOCK_FEATURE_REQUESTS:
        fr = FeatureRequest(
            workspace_id=workspace_id,
            author_id=author_id,
            title=fr_data["title"],
            description=fr_data.get("description"),
            status=fr_data.get("status", "open"),
            vote_count=fr_data.get("vote_count", 1),
        )
        db.add(fr)
        await db.flush()

        vote = FeatureVote(feature_request_id=fr.id, user_id=author_id)
        db.add(vote)

    await db.flush()
    logger.info("Seeded mock feature requests for workspace=%s", workspace_id)


async def list_feature_requests(
    db: AsyncSession, workspace_id: uuid.UUID, current_user_id: uuid.UUID
) -> list[dict]:
    """List all feature requests for a workspace, sorted by vote count descending."""
    result = await db.execute(
        select(FeatureRequest)
        .where(FeatureRequest.workspace_id == workspace_id)
        .options(selectinload(FeatureRequest.author), selectinload(FeatureRequest.votes))
        .order_by(FeatureRequest.vote_count.desc(), FeatureRequest.created_at.desc())
    )
    requests = result.scalars().all()

    output = []
    for fr in requests:
        has_voted = any(v.user_id == current_user_id for v in fr.votes)
        output.append({
            "id": fr.id,
            "workspace_id": fr.workspace_id,
            "author_id": fr.author_id,
            "author_email": fr.author.email if fr.author else None,
            "author_name": fr.author.display_name if fr.author else None,
            "title": fr.title,
            "description": fr.description,
            "status": fr.status,
            "vote_count": fr.vote_count,
            "has_voted": has_voted,
            "created_at": fr.created_at,
            "updated_at": fr.updated_at,
        })
    return output


async def create_feature_request(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    author_id: uuid.UUID,
    payload: FeatureRequestCreate,
) -> FeatureRequest:
    """Create a new feature request. The author auto-upvotes it."""
    fr = FeatureRequest(
        workspace_id=workspace_id,
        author_id=author_id,
        title=payload.title,
        description=payload.description,
        vote_count=1,
    )
    db.add(fr)
    await db.flush()

    vote = FeatureVote(feature_request_id=fr.id, user_id=author_id)
    db.add(vote)
    await db.flush()
    await db.refresh(fr, attribute_names=["author", "votes"])
    logger.info("Feature request created: id=%s workspace=%s", fr.id, workspace_id)
    return fr


async def get_feature_request(
    db: AsyncSession, request_id: uuid.UUID, workspace_id: uuid.UUID
) -> FeatureRequest:
    """Fetch a single feature request scoped to workspace."""
    result = await db.execute(
        select(FeatureRequest)
        .where(
            FeatureRequest.id == request_id,
            FeatureRequest.workspace_id == workspace_id,
        )
        .options(selectinload(FeatureRequest.author), selectinload(FeatureRequest.votes))
    )
    fr = result.scalar_one_or_none()
    if fr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )
    return fr


async def update_feature_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: FeatureRequestUpdate,
) -> FeatureRequest:
    """Update a feature request's title, description, or status.

    Only the original author may update the request.
    """
    fr = await get_feature_request(db, request_id, workspace_id)

    if fr.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can update this feature request",
        )

    if payload.title is not None:
        fr.title = payload.title
    if payload.description is not None:
        fr.description = payload.description
    if payload.status is not None:
        fr.status = payload.status.value

    db.add(fr)
    await db.flush()
    await db.refresh(fr)
    logger.info("Feature request updated: id=%s status=%s", request_id, fr.status)
    return fr


async def delete_feature_request(
    db: AsyncSession, request_id: uuid.UUID, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Delete a feature request and all its votes (cascaded).

    Only the original author may delete the request.
    """
    fr = await get_feature_request(db, request_id, workspace_id)

    if fr.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can delete this feature request",
        )

    await db.delete(fr)
    await db.flush()
    logger.info("Feature request deleted: id=%s", request_id)


async def toggle_vote(
    db: AsyncSession,
    request_id: uuid.UUID,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Toggle a user's vote on a feature request. Returns new vote state."""
    fr = await get_feature_request(db, request_id, workspace_id)

    existing_vote = await db.execute(
        select(FeatureVote).where(
            FeatureVote.feature_request_id == request_id,
            FeatureVote.user_id == user_id,
        )
    )
    vote = existing_vote.scalar_one_or_none()

    if vote:
        await db.delete(vote)
        fr.vote_count = max(0, fr.vote_count - 1)
        voted = False
    else:
        new_vote = FeatureVote(feature_request_id=request_id, user_id=user_id)
        db.add(new_vote)
        fr.vote_count = fr.vote_count + 1
        voted = True

    db.add(fr)
    await db.flush()
    await db.refresh(fr)
    logger.info(
        "Vote toggled: request=%s user=%s voted=%s count=%d",
        request_id, user_id, voted, fr.vote_count,
    )
    return {"has_voted": voted, "vote_count": fr.vote_count}
