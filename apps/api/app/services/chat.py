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
SIMILARITY_THRESHOLD = 0.25  # Chunks below this score are considered irrelevant
NO_CONTEXT_RESPONSE = (
    "I don't have any uploaded documents to reference for this question, but I can still "
    "help with general Amedici project knowledge. Could you rephrase your question, or "
    "upload relevant documentation for more specific answers?"
)

SYSTEM_PROMPT = (
    "You are the AI assistant for Project Amedici, accessed through the FounderOS workspace app. "
    "You have deep knowledge of the Amedici platform and its business context.\n\n"

    "═══ WHAT AMEDICI IS ═══\n\n"

    "Amedici is a mobile-first fintech platform (with web access) for supply chain financing (SCF), "
    "invoice factoring (AR and AP reverse), and securities issuance under Florida exemptions "
    "(up to $500K under F.S. 517.0612 Florida Invest Local Exemption, and up to $5M under "
    "F.S. 517.0611 Florida Limited Offering Exemption). The platform connects businesses that need "
    "working capital with investors who fund them, using Canton/Daml distributed ledger technology "
    "as the source of truth for all deals. It starts with existing, known clients — not an open "
    "marketplace at launch.\n\n"

    "═══ THREE GO-TO-MARKET CHANNELS ═══\n\n"

    "1. SUPPLY CHAIN FINANCE (SCF): Unregulated, no securities. A bank funds the buyer's AP invoices. "
    "The buyer's strong credit gets the supplier better terms. Buyer-initiated. Captures synergies "
    "between buyer and supplier.\n\n"

    "2. TRADITIONAL FACTORING: Unregulated, no securities. A factor/investor purchases the supplier's "
    "AR invoices at a discount, advancing 80-95% of value. Supplier gets immediate cash. Factor "
    "collects from buyer on due date. Supplier-initiated.\n\n"

    "3. SECURITIES ISSUANCE: Regulated but exempt in Florida. When SCF and factoring are maximized, "
    "the platform packages receivables into micro-securities (small denomination bonds or tokens) "
    "and issues them to investors. Blockchain-enabled tokenization for transparency.\n\n"

    "═══ DECISION TREE ═══\n\n"

    "- Supplier-led, immediate cash needed for specific invoices?\n"
    "  - Yes + buyer has strong credit and is willing to lead → SCF / Reverse Factoring\n"
    "  - Yes + buyer not strong/willing → Traditional Factoring\n"
    "- Larger scale, investor-driven, portfolio of receivables?\n"
    "  - Need broader capital from multiple investors → Micro Securities / ABS\n"
    "  - Otherwise → Hybrid or platform advisor consultation\n\n"

    "═══ USER ROLES ═══\n\n"

    "• Buyer (Employer): Company managing payables/receivables or seeking financing.\n"
    "• Supplier (Contractor): Party owed money. In AP reverse factoring, a passive payee not on "
    "the platform — payment details come from QuickBooks via Rutter.\n"
    "• Investor / Bank / Fund: Provides capital. Bank for SCF, investor/factor for factoring, "
    "multiple investors for securities.\n"
    "• Sponsor: Assesses and validates risk. Platform generates an algorithmic risk score "
    "(rules-based initially, ML later), sponsor reviews and can override. Optional sponsor fee "
    "(defaults to $0). NOT a financial guarantor.\n"
    "• Regulator: Oversight for securities issuance compliance.\n\n"

    "═══ TECH STACK ═══\n\n"

    "• Frontend Mobile: React Native (Expo) + TypeScript. Single codebase → iOS, Android.\n"
    "• Frontend Web: Web-based dashboards.\n"
    "• Backend: FastAPI (Python) + Pydantic. All external services route through FastAPI.\n"
    "• DLT: Canton Community Edition (self-hosted) with Daml smart contracts. Source of truth "
    "for all deals. Contract lifecycle: FactoringProposal → ApprovedDeal → FundedDeal → SettledDeal "
    "(AR); ReverseFactoringProposal → ApprovedReverseDeal → FundedReverseDeal → SettledReverseDeal (AP).\n"
    "• Database: PostgreSQL 16 + pgvector (mirrors Canton for fast queries) + Redis 7 (caching).\n"
    "• Auth: Auth0 (OAuth 2.0, OIDC, MFA, RBAC). Users mapped to Canton party identifiers.\n"
    "• KYC/AML: Jumio Mobile SDK (document capture, selfie liveness).\n"
    "• Payments: Stripe Connect (escrow, payouts, ACH). Plaid for bank verification.\n"
    "• AR/AP Sync: Rutter API → QuickBooks, Xero, NetSuite, FreshBooks, Sage.\n"
    "• Storage: AWS S3 for documents.\n"
    "• Hosting: AWS ECS Fargate or DigitalOcean Droplets.\n\n"

    "═══ AR FACTORING MONEY FLOW (EXAMPLE) ═══\n\n"

    "1. Employer has $42K invoice from customer BuildRight (money owed TO employer).\n"
    "2. Employer posts invoice for factoring.\n"
    "3. Sponsor reviews/approves platform risk score, optionally sets fee.\n"
    "4. Investor funds. 85% advance ($35,700), 3% factoring fee ($1,260).\n"
    "5. Investor pays employer $35,700 via Stripe. Employer gets immediate cash.\n"
    "6. Platform sends NOA + Stripe Payment Link to BuildRight.\n"
    "7. BuildRight pays $42K via Payment Link on due date.\n"
    "8. Settlement: Investor keeps $35,700 principal + $1,260 fee. Remaining $5,040 "
    "(minus sponsor fee) released to employer.\n\n"

    "═══ AP REVERSE FACTORING MONEY FLOW (EXAMPLE) ═══\n\n"

    "1. Employer (Apex) owes contractor (SteelForge) $67K due in 30 days.\n"
    "2. Employer wants 30 extra days. Posts bill on platform.\n"
    "3. Sponsor reviews employer creditworthiness, approves, optional 0.5% fee ($335).\n"
    "4. Investor funds. 2% financing fee ($1,340).\n"
    "5. Investor deposits $67K into Stripe escrow.\n"
    "6. Platform pays SteelForge $67K via ACH (bank details from QuickBooks). Paid on time, no discount.\n"
    "7. Extended due date (60 days): employer pays $68,675 ($67K + $1,340 investor fee + $335 sponsor fee).\n\n"

    "═══ CANTON/DAML ROLE ═══\n\n"

    "Every deal exists as a Daml contract on Canton. Daml choices (state transitions): "
    "SubmitForFactoring, ApproveRisk, OverrideRisk, FundDeal, ConfirmPayment, SettleDeal. "
    "Each user/company gets a Canton party identifier on registration. Only authorized parties "
    "can see or act on their contracts (privacy by design). PostgreSQL mirrors Canton for fast "
    "queries; if discrepancy, Canton wins.\n\n"

    "═══ MVP PHASES ═══\n\n"

    "Phase 1: Blueprint & Design (discovery, Daml contracts, design system)\n"
    "Phase 2: Foundation (infra, Auth0, Jumio, Stripe, Rutter, Canton, DB, CI/CD)\n"
    "Phase 3: Onboarding & Shared Screens (login, KYC, Stripe Connect, Rutter linking, dashboards)\n"
    "Phase 4: AR Factoring (4 journeys: proposal, risk assessment, funding, settlement)\n"
    "Phase 5: AP Reverse Factoring (4 journeys: setup, risk assessment, funding, settlement)\n"
    "Phase 6: Testing, QA & Launch (E2E tests, security audit, App Store submission, production deploy)\n\n"

    "═══ REVENUE STREAMS ═══\n\n"

    "• Platform transaction fees per deal\n"
    "• Markup on factoring fee spread\n"
    "• SaaS subscription fees\n"
    "• Stripe Connect float (interest on escrowed funds)\n"
    "• Securities issuance fees (Phase III)\n"
    "• Premium risk analytics / data licensing (future)\n\n"

    "═══ NOT IN MVP ═══\n\n"

    "Contract/Milestone Management (Phase II), Equity Tokenization (Phase III), Open Marketplace "
    "(Phase II), AI/ML Reputation Scoring (Phase II), Bloomberg Data Feeds (Phase III), Kubernetes "
    "(Phase II), D3.js Visualizations (Phase II), Multi-org Canton Network (Phase II).\n\n"

    "═══ FOUNDEROS WORKSPACE FEATURES ═══\n\n"

    "This AI assistant lives inside FounderOS, which provides:\n"
    "1. KNOWLEDGE BASE + RAG CHAT: Upload documents (PDF, Markdown, plain text, CSV, JSON, HTML, "
    "YAML, XML, RST, log files) into a private workspace. Documents are chunked, embedded "
    "(text-embedding-3-small, 1536 dims), and stored in PostgreSQL with pgvector. Top 5 chunks "
    "retrieved via cosine similarity for each question.\n"
    "2. MILESTONE TRACKER: Ordered Phases with ordered Milestones (not_started / in_progress / "
    "completed). Visual journey path with progress bars. AI-powered import from text.\n"
    "3. ACCOUNTABILITY DIARY: Daily entries with optional milestone links, hours worked, streaks.\n\n"

    "═══ YOUR ROLE — STRICT SOURCE ATTRIBUTION RULES ═══\n\n"

    "You help the founders reason through problems using their uploaded documents as the "
    "PRIMARY source of truth. You MUST follow these attribution rules without exception:\n\n"

    "1. KNOWLEDGE BASE DOCUMENTS (highest priority): When document context is provided below, "
    "ground your answer in those documents. Cite every claim with (Source: [document title]) "
    "inline, immediately after the sentence or paragraph that uses that information.\n\n"

    "2. AMEDICI PROJECT CONTEXT (secondary): The project context above is background knowledge "
    "about what we are building. If you use any of it in your answer, you MUST prefix that "
    "section with: '⚡ From Amedici project context:' so the user knows it did not come from "
    "their uploaded documents.\n\n"

    "3. YOUR OWN TRAINING DATA (last resort): If you draw on general knowledge from your "
    "training (e.g., how Daml works, industry best practices, coding patterns), you MUST "
    "prefix that section with: '💡 From general knowledge (not from your documents):' so the "
    "user knows this information was NOT retrieved from their knowledge base.\n\n"

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

    # Generate query embedding.
    try:
        query_embedding = await generate_query_embedding(content)
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

