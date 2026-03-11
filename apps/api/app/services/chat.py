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

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.milestone import Milestone
from app.models.phase import Phase
from app.models.workspace import Workspace
from app.services.documents import generate_query_embedding
from app.services.workspace_settings import get_openai_api_key

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────

CHAT_MODEL = "gpt-5.2"
TOP_K_CHUNKS = 5
SIMILARITY_THRESHOLD = 0.25  # Chunks below this score are considered irrelevant
NO_CONTEXT_RESPONSE = (
    "I don't have any uploaded documents to reference for this question. Could you rephrase "
    "your question, or upload relevant documentation for more specific answers?"
)

BASE_SYSTEM_PROMPT = (
    "You are the AI assistant for FoundersForge, a workspace app that helps startup teams "
    "manage milestones, track accountability, and build a knowledge base.\n\n"

    "═══ FOUNDERSFORGE WORKSPACE FEATURES ═══\n\n"

    "1. KNOWLEDGE BASE + RAG CHAT: Upload documents (PDF, Markdown, plain text, CSV, JSON, HTML, "
    "YAML, XML, RST, log files) into a private workspace. Documents are chunked, embedded, "
    "and stored with vector search. Top 5 chunks retrieved via cosine similarity per question.\n"
    "2. MILESTONE TRACKER: Ordered Phases with ordered Milestones (not_started / in_progress / "
    "completed). Visual journey path with progress bars. AI-powered import from text.\n"
    "3. ACCOUNTABILITY DIARY: Daily entries with optional milestone links, hours worked, streaks.\n\n"

    "═══ YOUR ROLE — STRICT SOURCE ATTRIBUTION RULES ═══\n\n"

    "You help the founders reason through problems using their uploaded documents as the "
    "PRIMARY source of truth. You MUST follow these attribution rules without exception:\n\n"

    "1. KNOWLEDGE BASE DOCUMENTS (highest priority): When document context is provided below, "
    "ground your answer in those documents. Cite every claim with (Source: [document title]) "
    "inline, immediately after the sentence or paragraph that uses that information.\n\n"

    "2. PROJECT BRIEF CONTEXT (secondary): If a project brief is provided below, it is background "
    "knowledge about what the team is building. If you use any of it in your answer, you MUST "
    "prefix that section with: '⚡ From project brief:' so the user knows it did not come from "
    "their uploaded documents.\n\n"

    "3. YOUR OWN TRAINING DATA (last resort): If you draw on general knowledge from your "
    "training (e.g., industry best practices, coding patterns), you MUST prefix that section "
    "with: '💡 From general knowledge (not from your documents):' so the user knows this "
    "information was NOT retrieved from their knowledge base.\n\n"

    "4. MIXED ANSWERS: If your answer combines multiple sources, label EACH part separately. "
    "Never blend sourced and unsourced information without attribution.\n\n"

    "5. NO SILENT FALLBACKS: If the uploaded documents don't contain what's needed, SAY SO "
    "explicitly — e.g., 'Your uploaded documents don't cover this topic. Here's what I can "
    "offer from general knowledge:' — before providing supplementary information.\n\n"

    "6. REASONING & LOGIC: When the user asks you to help reason through a problem, walk "
    "through the logic step by step. Reference specific passages from their documents and "
    "quote them when useful. If you identify gaps in the documents, call them out.\n\n"

    "Be concise, precise, and helpful. Always prioritize the user's uploaded documents."
)


async def _build_workspace_system_prompt(
    db: AsyncSession, workspace_id: uuid.UUID
) -> str:
    """Build the knowledge-base system prompt, injecting the project brief if set."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()

    prompt = BASE_SYSTEM_PROMPT

    if workspace and workspace.project_brief:
        prompt += (
            "\n\n═══ PROJECT BRIEF (provided by the workspace owner) ═══\n\n"
            f"{workspace.project_brief}"
        )

    return prompt

# ── Conversation CRUD ────────────────────────────────────────────


async def list_conversations(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    milestone_id: uuid.UUID | None = None,
) -> list[Conversation]:
    """List conversations for a workspace, optionally filtered by milestone.

    Args:
        db: Active database session.
        workspace_id: The workspace to list conversations for.
        milestone_id: If provided, only return conversations for this milestone.
                      If None, return only knowledge-base conversations (no milestone).

    Returns:
        List of Conversation objects (without messages).
    """
    stmt = select(Conversation).where(Conversation.workspace_id == workspace_id)
    if milestone_id is not None:
        stmt = stmt.where(Conversation.milestone_id == milestone_id)
    else:
        stmt = stmt.where(Conversation.milestone_id.is_(None))
    result = await db.execute(stmt.order_by(Conversation.updated_at.desc()))
    return list(result.scalars().all())


async def create_conversation(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
    milestone_id: uuid.UUID | None = None,
) -> Conversation:
    """Create a new conversation, optionally scoped to a milestone.

    Args:
        db: Active database session.
        workspace_id: The workspace to create the conversation in.
        user_id: The user creating the conversation.
        title: The conversation title.
        milestone_id: If provided, scope this conversation to a milestone.

    Returns:
        The newly created Conversation.
    """
    conversation = Conversation(
        workspace_id=workspace_id,
        created_by=user_id,
        title=title,
        milestone_id=milestone_id,
    )
    db.add(conversation)
    await db.flush()
    logger.info(
        "Conversation created: id=%s workspace=%s milestone=%s",
        conversation.id, workspace_id, milestone_id,
    )
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


# ── Milestone Prompt Builder ──────────────────────────────────────


async def _build_milestone_system_prompt(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> str:
    """Dynamically compose a system prompt for a milestone-scoped conversation.

    Fetches the target milestone (with phase, attachments) and the full
    project roadmap to give the AI complete context.
    """
    ms_result = await db.execute(
        select(Milestone)
        .where(Milestone.id == milestone_id)
        .options(
            selectinload(Milestone.phase),
            selectinload(Milestone.attachments),
        )
    )
    milestone = ms_result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    phases_result = await db.execute(
        select(Phase)
        .where(Phase.workspace_id == workspace_id)
        .options(selectinload(Phase.milestones))
        .order_by(Phase.sort_order)
    )
    phases = phases_result.scalars().all()

    roadmap_lines: list[str] = []
    for phase in phases:
        sorted_ms = sorted(phase.milestones, key=lambda m: m.sort_order)
        completed = sum(1 for m in sorted_ms if m.status == "completed")
        roadmap_lines.append(f"{phase.title} ({completed}/{len(sorted_ms)} completed)")
        for ms in sorted_ms:
            marker = " <-- YOU ARE HERE" if ms.id == milestone_id else ""
            roadmap_lines.append(f"  - [{ms.status}] {ms.title}{marker}")

    roadmap_text = "\n".join(roadmap_lines)

    attachment_names = [a.filename for a in milestone.attachments] if milestone.attachments else []
    attachments_str = ", ".join(attachment_names) if attachment_names else "None"

    return (
        "You are an AI assistant embedded inside FounderOS, helping a startup team "
        "iterate on a specific milestone within their project.\n\n"

        "=== CURRENT MILESTONE ===\n"
        f"Phase: {milestone.phase.title}\n"
        f"Title: {milestone.title}\n"
        f"Status: {milestone.status}\n"
        f"Description: {milestone.description or '(none)'}\n"
        f"Notes: {milestone.notes or '(none)'}\n"
        f"Attached Documents: {attachments_str}\n\n"

        "=== FULL PROJECT ROADMAP ===\n"
        f"{roadmap_text}\n\n"

        "=== YOUR ROLE ===\n"
        "You are an expert advisor for this specific milestone. Help the user iterate on it: "
        "suggest implementation approaches, identify blockers, point out dependencies on other "
        "milestones, refine scope, and provide technical or strategic guidance.\n\n"
        "You have full awareness of the project roadmap above and can reference any milestone or "
        "phase when relevant. Ground your answers in the milestone details and project context. "
        "If knowledge base documents are provided below, use them as additional context and cite "
        "them with (Source: [document title]) inline.\n\n"
        "Be concise, actionable, and specific. Reference the milestone's notes and attached "
        "documents when relevant. If the user asks about something outside your context, say so "
        "and offer to help with what you do know."
    )


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
    system_prompt_override: str | None = None,
) -> list[dict]:
    """Build the messages array for the OpenAI chat completion.

    Args:
        question: The user's question.
        chunks: Retrieved document chunks with context.
        conversation_history: Previous messages for context continuity.
        system_prompt_override: If provided, use this instead of the default SYSTEM_PROMPT.

    Returns:
        List of message dicts for the OpenAI API.
    """
    prompt = system_prompt_override if system_prompt_override else BASE_SYSTEM_PROMPT
    messages: list[dict] = [{"role": "system", "content": prompt}]

    if chunks:
        context_parts = []
        for chunk in chunks:
            sim = chunk.get("similarity", 0)
            context_parts.append(
                f"[Document: {chunk['document_title']}] (relevance: {sim:.2f})\n{chunk['content']}"
            )
        context_text = "\n\n---\n\n".join(context_parts)
        messages.append({
            "role": "system",
            "content": (
                f"══ RETRIEVED DOCUMENT CONTEXT ({len(chunks)} relevant chunks) ══\n\n"
                f"The following excerpts were retrieved from the user's uploaded knowledge base. "
                f"Use these as your PRIMARY source and cite them with (Source: [document title]).\n\n"
                f"{context_text}"
            ),
        })
    else:
        messages.append({
            "role": "system",
            "content": (
                "══ NO RELEVANT DOCUMENT CONTEXT FOUND ══\n\n"
                "No uploaded documents matched this query above the relevance threshold. "
                "You may answer using the Amedici project context or your general knowledge, "
                "but you MUST explicitly label which source you are drawing from. "
                "Start your answer by noting: 'Your uploaded documents don't cover this topic.'"
            ),
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

    # Resolve workspace OpenAI API key (workspace-provided → server default).
    openai_key = await get_openai_api_key(db, workspace_id)

    # Generate query embedding.
    try:
        query_embedding = await generate_query_embedding(content, openai_api_key=openai_key)
    except Exception as exc:
        logger.error("Failed to generate query embedding: %s", exc)
        error_msg = "Sorry, I encountered an error processing your question. Please try again."
        yield _sse_data({"type": "error", "content": error_msg})
        return

    # Retrieve relevant chunks and filter by similarity threshold.
    all_chunks = await _retrieve_relevant_chunks(db, workspace_id, query_embedding)
    chunks = [c for c in all_chunks if c["similarity"] >= SIMILARITY_THRESHOLD]

    logger.info(
        "RAG retrieval: %d/%d chunks above threshold (%.2f). Top score: %.3f",
        len(chunks),
        len(all_chunks),
        SIMILARITY_THRESHOLD,
        all_chunks[0]["similarity"] if all_chunks else 0.0,
    )

    if not chunks:
        # No relevant chunks found — answer from project context only.
        # Pass empty chunks so the model still has the system prompt context.
        chunks = []

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

    # Build system prompt — milestone-scoped or dynamic workspace prompt.
    if conversation.milestone_id is not None:
        system_prompt = await _build_milestone_system_prompt(
            db, conversation.milestone_id, workspace_id
        )
    else:
        system_prompt = await _build_workspace_system_prompt(db, workspace_id)

    messages = _build_rag_prompt(
        content, chunks, history[:-1], system_prompt_override=system_prompt
    )

    # Stream response from OpenAI.
    full_response = ""
    try:
        if not openai_key:
            error_msg = (
                "No OpenAI API key configured. Add one in Settings → Integrations."
            )
            yield _sse_data({"type": "error", "content": error_msg})
            return
        else:
            client = AsyncOpenAI(api_key=openai_key)
            stream = await client.chat.completions.create(
                model=CHAT_MODEL,
                messages=messages,
                stream=True,
                temperature=0.3,
                max_completion_tokens=2000,
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

    # Build source citations — only for chunks that were actually relevant.
    sources = [
        {
            "document_id": chunk["document_id"],
            "document_title": chunk["document_title"],
            "chunk_id": chunk["chunk_id"],
            "snippet": chunk["content"][:200],
            "similarity": round(chunk["similarity"], 3),
        }
        for chunk in chunks
    ] if chunks else []

    # Save assistant message with sources.
    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=full_response,
        sources=sources if sources else None,
    )
    db.add(assistant_message)
    await db.commit()

    # Send sources and completion signal (only if we have relevant sources).
    if sources:
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

