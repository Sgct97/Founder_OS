"""Document router — knowledge base document CRUD endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.documents import (
    DocumentDetailResponse,
    DocumentResponse,
    DocumentStatusResponse,
)
from app.services import documents as documents_service

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
    response_model=list[DocumentResponse],
    summary="List all documents in workspace",
)
async def list_documents(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DocumentResponse]:
    """Return all documents for the user's workspace, newest first."""
    workspace_id = _require_workspace(current_user)
    documents = await documents_service.list_documents(db, workspace_id)
    return [DocumentResponse.model_validate(d) for d in documents]


@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
)
async def upload_document(
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
) -> DocumentResponse:
    """Upload a document to the knowledge base.

    Accepts PDF, Markdown, or plain text files via multipart form.
    The document is queued for processing (parsing, chunking, embedding)
    which happens asynchronously in the background.
    """
    workspace_id = _require_workspace(current_user)
    document = await documents_service.create_document(
        db, workspace_id, current_user.id, file
    )

    # Kick off background processing.
    background_tasks.add_task(documents_service.process_document, document.id)

    return DocumentResponse.model_validate(document)


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Get document details",
)
async def get_document(
    document_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentDetailResponse:
    """Return detailed information about a specific document."""
    workspace_id = _require_workspace(current_user)
    document = await documents_service.get_document(db, document_id, workspace_id)
    return DocumentDetailResponse.model_validate(document)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
)
async def delete_document(
    document_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a document, its chunks, and the uploaded file."""
    workspace_id = _require_workspace(current_user)
    await documents_service.delete_document(db, document_id, workspace_id)


@router.get(
    "/{document_id}/status",
    response_model=DocumentStatusResponse,
    summary="Check document processing status",
)
async def get_document_status(
    document_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentStatusResponse:
    """Lightweight status endpoint for polling during processing."""
    workspace_id = _require_workspace(current_user)
    document = await documents_service.get_document(db, document_id, workspace_id)
    return DocumentStatusResponse.model_validate(document)

