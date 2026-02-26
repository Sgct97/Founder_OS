"""Chat service — RAG retrieval, conversation management, and streaming."""

import json
import logging
import uuid
from collections.abc import AsyncGenerator

from fastapi import HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.message import Message
from app.services.documents import generate_query_embedding

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────

CHAT_MODEL = "gpt-5.2"
TOP_K_CHUNKS = 5
NO_CONTEXT_RESPONSE = (
    "I don't have enough information in your documents to answer this. "
    "Try uploading relevant documentation."
)

SYSTEM_PROMPT = (
    "You are a helpful assistant for FounderOS, a knowledge base tool for startup founders. "
    "Answer the user's question using ONLY the context provided below. "
    "If the context doesn't contain enough information to answer the question, say so clearly. "
    "Cite which document each piece of information comes from using [Document: title] notation. "
    "Be concise and precise."
)

# ── Conversation CRUD ────────────────────────────────────────────


async def list_conversations(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[Conversation]:
    """List all conversations for a workspace, newest first.

    Args:
        db: Active database session.
        workspace_id: The workspace to list conversations for.

    Returns:
        List of Conversation objects (without messages).
    """
    result = await db.execute(
        select(Conversation)
        .where(Conversation.workspace_id == workspace_id)
        .order_by(Conversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def create_conversation(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
) -> Conversation:
    """Create a new conversation.

    Args:
        db: Active database session.
        workspace_id: The workspace to create the conversation in.
        user_id: The user creating the conversation.
        title: The conversation title.

    Returns:
        The newly created Conversation.
    """
    conversation = Conversation(
        workspace_id=workspace_id,
        created_by=user_id,
        title=title,
    )
    db.add(conversation)
    await db.flush()
    logger.info("Conversation created: id=%s workspace=%s", conversation.id, workspace_id)
    return conversation


async def get_conversation(
    db: AsyncSession, conversation_id: uuid.UUID, workspace_id: uuid.UUID
) -> Conversation:
    """Fetch a conversation with its messages.

    Args:
        db: Active database session.
        conversation_id: The conversation to retrieve.
        workspace_id: The workspace the conversation must belong to.

    Returns:
        The Conversation with messages loaded.

    Raises:
        HTTPException 404: If the conversation is not found.
    """
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


async def get_conversation_messages(
    db: AsyncSession, conversation_id: uuid.UUID, workspace_id: uuid.UUID
) -> list[Message]:
    """Fetch messages for a conversation.

    Args:
        db: Active database session.
        conversation_id: The conversation to fetch messages for.
        workspace_id: The workspace the conversation must belong to.

    Returns:
        List of messages in chronological order.
    """
    # Verify conversation exists and belongs to workspace.
    await get_conversation(db, conversation_id, workspace_id)

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def delete_conversation(
    db: AsyncSession, conversation_id: uuid.UUID, workspace_id: uuid.UUID
) -> None:
    """Delete a conversation and all its messages.

    Args:
        db: Active database session.
        conversation_id: The conversation to delete.
        workspace_id: The workspace the conversation must belong to.
    """
    conversation = await get_conversation(db, conversation_id, workspace_id)
    await db.delete(conversation)
    await db.flush()
    logger.info("Conversation deleted: id=%s", conversation_id)


# ── RAG Pipeline ─────────────────────────────────────────────────


async def _retrieve_relevant_chunks(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    query_embedding: list[float],
    top_k: int = TOP_K_CHUNKS,
) -> list[dict]:
    """Find the most relevant document chunks using cosine similarity.

    Args:
        db: Active database session.
        workspace_id: Scope search to this workspace's documents.
        query_embedding: The embedding vector for the user's question.
        top_k: Number of chunks to retrieve.

    Returns:
        List of dicts with chunk content, document info, and similarity score.
    """
    # Use raw SQL for the pgvector cosine distance operator.
    query = text("""
        SELECT
            dc.id AS chunk_id,
            dc.content,
            dc.document_id,
            d.title AS document_title,
            1 - (dc.embedding <=> :query_embedding) AS similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE d.workspace_id = :workspace_id
          AND d.status = 'ready'
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> :query_embedding
        LIMIT :top_k
    """)

    result = await db.execute(
        query,
        {
            "query_embedding": str(query_embedding),
            "workspace_id": str(workspace_id),
            "top_k": top_k,
        },
    )
    rows = result.fetchall()

    return [
        {
            "chunk_id": str(row.chunk_id),
            "content": row.content,
            "document_id": str(row.document_id),
            "document_title": row.document_title,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]


def _build_rag_prompt(
    question: str,
    chunks: list[dict],
    conversation_history: list[dict] | None = None,
) -> list[dict]:
    """Build the messages array for the OpenAI chat completion.

    Args:
        question: The user's question.
        chunks: Retrieved document chunks with context.
        conversation_history: Previous messages for context continuity.

    Returns:
        List of message dicts for the OpenAI API.
    """
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if chunks:
        context_parts = []
        for chunk in chunks:
            context_parts.append(
                f"[Document: {chunk['document_title']}]\n{chunk['content']}"
            )
        context_text = "\n\n---\n\n".join(context_parts)
        messages.append({
            "role": "system",
            "content": f"Context from uploaded documents:\n\n{context_text}",
        })

    # Add conversation history (last 10 messages for context window budget).
    if conversation_history:
        for msg in conversation_history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})
    return messages


async def send_message_streaming(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str,
) -> AsyncGenerator[str, None]:
    """Process a user message and stream the AI response via SSE.

    This function:
    1. Saves the user message
    2. Generates an embedding for the question
    3. Retrieves relevant document chunks
    4. Streams the AI response
    5. Saves the complete response with source citations

    Args:
        db: Active database session.
        conversation_id: The conversation to add the message to.
        workspace_id: The workspace for document scoping.
        user_id: The user sending the message.
        content: The user's question text.

    Yields:
        SSE-formatted data strings with streaming response chunks.
    """
    # Verify conversation exists.
    conversation = await get_conversation(db, conversation_id, workspace_id)

    # Save user message.
    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=content,
    )
    db.add(user_message)
    await db.flush()

    # Update conversation title from first message.
    if len(conversation.messages) <= 1:
        conversation.title = content[:100]
        db.add(conversation)
        await db.flush()

    await db.commit()

    # Generate query embedding.
    try:
        query_embedding = await generate_query_embedding(content)
    except Exception as exc:
        logger.error("Failed to generate query embedding: %s", exc)
        error_msg = "Sorry, I encountered an error processing your question. Please try again."
        yield _sse_data({"type": "error", "content": error_msg})
        return

    # Retrieve relevant chunks.
    chunks = await _retrieve_relevant_chunks(db, workspace_id, query_embedding)

    if not chunks:
        # No documents or no relevant chunks found.
        yield _sse_data({"type": "content", "content": NO_CONTEXT_RESPONSE})

        # Save the response.
        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=NO_CONTEXT_RESPONSE,
            sources=None,
        )
        db.add(assistant_message)
        await db.commit()

        yield _sse_data({"type": "done", "message_id": str(assistant_message.id)})
        return

    # Build conversation history.
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in history_result.scalars().all()
        if m.role in ("user", "assistant")
    ]

    # Build RAG prompt.
    messages = _build_rag_prompt(content, chunks, history[:-1])  # exclude current msg

    # Stream response from OpenAI.
    full_response = ""
    try:
        if not settings.openai_api_key:
            # Fallback for testing without API key.
            fallback = (
                f"Based on the documents, here is what I found:\n\n"
                f"From [{chunks[0]['document_title']}]: {chunks[0]['content'][:200]}..."
            )
            full_response = fallback
            yield _sse_data({"type": "content", "content": fallback})
        else:
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            stream = await client.chat.completions.create(
                model=CHAT_MODEL,
                messages=messages,
                stream=True,
                temperature=0.3,
                max_tokens=2000,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield _sse_data({"type": "content", "content": token})

    except Exception as exc:
        logger.exception("OpenAI streaming failed: %s", exc)
        error_msg = "Sorry, I encountered an error generating a response. Please try again."
        yield _sse_data({"type": "error", "content": error_msg})
        return

    # Build source citations.
    sources = [
        {
            "document_id": chunk["document_id"],
            "document_title": chunk["document_title"],
            "chunk_id": chunk["chunk_id"],
            "snippet": chunk["content"][:200],
        }
        for chunk in chunks
    ]

    # Save assistant message with sources.
    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=full_response,
        sources=sources,
    )
    db.add(assistant_message)
    await db.commit()

    # Send sources and completion signal.
    yield _sse_data({
        "type": "sources",
        "sources": sources,
    })
    yield _sse_data({
        "type": "done",
        "message_id": str(assistant_message.id),
    })


def _sse_data(data: dict) -> str:
    """Format a dict as an SSE data string.

    Args:
        data: Dictionary to serialize as JSON.

    Returns:
        JSON string for SSE event data.
    """
    return json.dumps(data)

