"""Feature requests router — CRUD and voting endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.feature_requests import (
    FeatureRequestCreate,
    FeatureRequestResponse,
    FeatureRequestUpdate,
)
from app.services import feature_requests as fr_service

router = APIRouter()


def _require_workspace(user: CurrentUser) -> uuid.UUID:
    if user.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to a workspace",
        )
    return user.workspace_id


@router.get(
    "/feature-requests",
    response_model=list[FeatureRequestResponse],
    summary="List all feature requests for the workspace",
)
async def list_feature_requests(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[FeatureRequestResponse]:
    workspace_id = _require_workspace(current_user)
    items = await fr_service.list_feature_requests(db, workspace_id, current_user.id)
    return [FeatureRequestResponse(**item) for item in items]


@router.post(
    "/feature-requests",
    response_model=FeatureRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new feature request",
)
async def create_feature_request(
    payload: FeatureRequestCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FeatureRequestResponse:
    workspace_id = _require_workspace(current_user)
    fr = await fr_service.create_feature_request(
        db, workspace_id, current_user.id, payload
    )
    return FeatureRequestResponse(
        id=fr.id,
        workspace_id=fr.workspace_id,
        author_id=fr.author_id,
        author_email=fr.author.email if fr.author else None,
        author_name=fr.author.display_name if fr.author else None,
        title=fr.title,
        description=fr.description,
        status=fr.status,
        vote_count=fr.vote_count,
        has_voted=True,
        created_at=fr.created_at,
        updated_at=fr.updated_at,
    )


@router.patch(
    "/feature-requests/{request_id}",
    response_model=FeatureRequestResponse,
    summary="Update a feature request",
)
async def update_feature_request(
    request_id: uuid.UUID,
    payload: FeatureRequestUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FeatureRequestResponse:
    workspace_id = _require_workspace(current_user)
    fr = await fr_service.update_feature_request(db, request_id, workspace_id, payload)
    has_voted = any(v.user_id == current_user.id for v in fr.votes)
    return FeatureRequestResponse(
        id=fr.id,
        workspace_id=fr.workspace_id,
        author_id=fr.author_id,
        author_email=fr.author.email if fr.author else None,
        author_name=fr.author.display_name if fr.author else None,
        title=fr.title,
        description=fr.description,
        status=fr.status,
        vote_count=fr.vote_count,
        has_voted=has_voted,
        created_at=fr.created_at,
        updated_at=fr.updated_at,
    )


@router.delete(
    "/feature-requests/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a feature request",
)
async def delete_feature_request(
    request_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    workspace_id = _require_workspace(current_user)
    await fr_service.delete_feature_request(db, request_id, workspace_id)


@router.post(
    "/feature-requests/{request_id}/vote",
    summary="Toggle vote on a feature request",
)
async def toggle_vote(
    request_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    workspace_id = _require_workspace(current_user)
    return await fr_service.toggle_vote(db, request_id, workspace_id, current_user.id)
