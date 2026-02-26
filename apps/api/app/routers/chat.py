"""Chat router — RAG conversation endpoints with SSE streaming."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)
from app.services import chat as chat_service

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
    "/conversations",
    response_model=list[ConversationResponse],
    summary="List all conversations",
)
async def list_conversations(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ConversationResponse]:
    """Return all conversations for the user's workspace, newest first."""
    workspace_id = _require_workspace(current_user)
    conversations = await chat_service.list_conversations(db, workspace_id)
    return [ConversationResponse.model_validate(c) for c in conversations]


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
)
async def create_conversation(
    payload: ConversationCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConversationResponse:
    """Start a new chat conversation in the workspace."""
    workspace_id = _require_workspace(current_user)
    conversation = await chat_service.create_conversation(
        db, workspace_id, current_user.id, payload.title
    )
    return ConversationResponse.model_validate(conversation)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
    summary="Get conversation messages",
)
async def get_messages(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MessageResponse]:
    """Return all messages in a conversation, in chronological order."""
    workspace_id = _require_workspace(current_user)
    messages = await chat_service.get_conversation_messages(
        db, conversation_id, workspace_id
    )
    return [MessageResponse.model_validate(m) for m in messages]


@router.post(
    "/conversations/{conversation_id}/messages",
    summary="Send a message and get AI response (SSE stream)",
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventSourceResponse:
    """Send a message to the AI and receive a streamed response.

    Returns a Server-Sent Events stream with the following event types:
    - content: A token of the AI response
    - sources: Document citations for the response
    - done: Stream complete, includes the saved message ID
    - error: An error occurred during processing
    """
    workspace_id = _require_workspace(current_user)

    # Validate conversation exists *before* entering the SSE generator.
    # Raising HTTPException inside an SSE generator causes event-loop errors.
    await chat_service.get_conversation(db, conversation_id, workspace_id)

    async def event_generator():  # type: ignore[no-untyped-def]
        async for data in chat_service.send_message_streaming(
            db, conversation_id, workspace_id, current_user.id, payload.content
        ):
            yield {"data": data}

    return EventSourceResponse(event_generator())


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a conversation and all its messages."""
    workspace_id = _require_workspace(current_user)
    await chat_service.delete_conversation(db, conversation_id, workspace_id)

