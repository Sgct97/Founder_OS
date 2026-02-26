"""Document service — CRUD, file processing pipeline, and embedding generation."""

import logging
import os
import uuid
from pathlib import Path

import tiktoken
from fastapi import HTTPException, UploadFile, status
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document
from app.models.document_chunk import EMBEDDING_DIMENSION, DocumentChunk

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────

EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_TARGET_TOKENS = 512
CHUNK_OVERLAP_TOKENS = 50
ALLOWED_EXTENSIONS = {"pdf", "md", "txt", "csv", "json", "html", "htm", "yaml", "yml", "log", "rst", "xml"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# ── CRUD Operations ──────────────────────────────────────────────


async def list_documents(db: AsyncSession, workspace_id: uuid.UUID) -> list[Document]:
    """List all documents for a workspace, newest first.

    Args:
        db: Active database session.
        workspace_id: The workspace to list documents for.

    Returns:
        List of Document objects.
    """
    result = await db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def get_document(
    db: AsyncSession, document_id: uuid.UUID, workspace_id: uuid.UUID
) -> Document:
    """Fetch a single document scoped to the workspace.

    Args:
        db: Active database session.
        document_id: The document to retrieve.
        workspace_id: The workspace the document must belong to.

    Returns:
        The Document object.

    Raises:
        HTTPException 404: If the document is not found.
    """
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


async def create_document(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    file: UploadFile,
) -> Document:
    """Save an uploaded file and create the document record.

    Args:
        db: Active database session.
        workspace_id: The workspace to add the document to.
        user_id: The user who uploaded the file.
        file: The uploaded file from the multipart form.

    Returns:
        The newly created Document with status "queued".

    Raises:
        HTTPException 400: If the file type is not supported or file is too large.
    """
    filename = file.filename or "untitled"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: .{extension}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content.
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large ({file_size} bytes). Maximum: {MAX_FILE_SIZE_BYTES} bytes",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    # Generate a unique document ID and save file to disk.
    doc_id = uuid.uuid4()
    upload_dir = Path(settings.upload_dir) / str(workspace_id) / str(doc_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename

    file_path.write_bytes(content)

    # Derive title from filename (strip extension).
    title = filename.rsplit(".", 1)[0] if "." in filename else filename

    document = Document(
        id=doc_id,
        workspace_id=workspace_id,
        uploaded_by=user_id,
        title=title,
        file_path=str(file_path),
        file_size_bytes=file_size,
        file_type=extension,
        status="queued",
    )
    db.add(document)
    await db.flush()
    logger.info(
        "Document created: id=%s title=%r workspace=%s",
        doc_id,
        title,
        workspace_id,
    )
    return document


async def delete_document(
    db: AsyncSession, document_id: uuid.UUID, workspace_id: uuid.UUID
) -> None:
    """Delete a document and its chunks, plus the file on disk.

    Args:
        db: Active database session.
        document_id: The document to delete.
        workspace_id: The workspace the document must belong to.
    """
    document = await get_document(db, document_id, workspace_id)

    # Remove file from disk.
    try:
        file_path = Path(document.file_path)
        if file_path.exists():
            file_path.unlink()
            # Remove empty parent directories.
            parent = file_path.parent
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()
    except OSError as exc:
        logger.warning("Failed to remove file %s: %s", document.file_path, exc)

    await db.delete(document)
    await db.flush()
    logger.info("Document deleted: id=%s", document_id)


# ── Document Processing Pipeline ────────────────────────────────


async def process_document(document_id: uuid.UUID) -> None:
    """Background task: parse document, chunk text, generate embeddings.

    This function creates its own database session since it runs as a
    background task outside the request lifecycle.

    Args:
        document_id: The document to process.
    """
    from app.database import async_session

    async with async_session() as db:
        try:
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
            if document is None:
                logger.error("Process: Document %s not found", document_id)
                return

            # Update status to processing.
            document.status = "processing"
            db.add(document)
            await db.commit()

            # 1. Parse the document file to raw text.
            file_path = Path(document.file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            raw_text = _parse_file(file_path, document.file_type)

            if not raw_text.strip():
                raise ValueError("Parsed document is empty — no text extracted")

            # 2. Chunk the text.
            chunks = _chunk_text(raw_text)
            logger.info(
                "Document %s: parsed %d characters, %d chunks",
                document_id,
                len(raw_text),
                len(chunks),
            )

            # 3. Generate embeddings for all chunks.
            embeddings = await _generate_embeddings([c["text"] for c in chunks])

            # 4. Store chunks in database.
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                db_chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=i,
                    content=chunk["text"],
                    token_count=chunk["token_count"],
                    embedding=embedding,
                    metadata_=chunk.get("metadata"),
                )
                db.add(db_chunk)

            # 5. Update document status.
            document.status = "ready"
            document.chunk_count = len(chunks)
            db.add(document)
            await db.commit()
            logger.info(
                "Document %s processed successfully: %d chunks",
                document_id,
                len(chunks),
            )

        except Exception as exc:
            logger.exception("Document %s processing failed: %s", document_id, exc)
            try:
                result = await db.execute(
                    select(Document).where(Document.id == document_id)
                )
                document = result.scalar_one_or_none()
                if document:
                    document.status = "failed"
                    document.error_message = str(exc)[:500]
                    db.add(document)
                    await db.commit()
            except Exception as inner_exc:
                logger.error(
                    "Failed to update document %s status to failed: %s",
                    document_id,
                    inner_exc,
                )


def _parse_file(file_path: Path, file_type: str) -> str:
    """Parse a file to raw text.

    Uses pypdf for PDFs, BeautifulSoup for HTML, and plain file reads
    for everything else (md, txt, csv, json, yaml, xml, log, rst).

    Args:
        file_path: Path to the file on disk.
        file_type: File extension (pdf, md, txt, html, csv, etc.).

    Returns:
        Extracted text content.
    """
    if file_type == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text and text.strip():
                pages.append(text.strip())
        return "\n\n".join(pages)

    if file_type in ("html", "htm"):
        from bs4 import BeautifulSoup

        raw_html = file_path.read_text(encoding="utf-8")
        soup = BeautifulSoup(raw_html, "html.parser")
        # Remove script and style elements.
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)

    # Everything else (md, txt, csv, json, yaml, xml, log, rst) — read as text.
    return file_path.read_text(encoding="utf-8")


def _chunk_text(
    text: str,
    target_tokens: int = CHUNK_TARGET_TOKENS,
    overlap_tokens: int = CHUNK_OVERLAP_TOKENS,
) -> list[dict]:
    """Split text into chunks with token counting and overlap.

    Args:
        text: Raw text to chunk.
        target_tokens: Target tokens per chunk.
        overlap_tokens: Overlap between consecutive chunks.

    Returns:
        List of dicts with keys: text, token_count, metadata.
    """
    enc = tiktoken.get_encoding("cl100k_base")

    # Split on paragraph boundaries first.
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[dict] = []
    current_tokens: list[int] = []
    current_texts: list[str] = []

    for paragraph in paragraphs:
        para_tokens = enc.encode(paragraph)

        # If adding this paragraph exceeds target, flush current chunk.
        if current_tokens and len(current_tokens) + len(para_tokens) > target_tokens:
            chunk_text = "\n\n".join(current_texts)
            chunks.append({
                "text": chunk_text,
                "token_count": len(current_tokens),
                "metadata": {"chunk_method": "paragraph_boundary"},
            })

            # Keep overlap tokens from the end of the current chunk.
            if overlap_tokens > 0 and len(current_tokens) > overlap_tokens:
                overlap_text = enc.decode(current_tokens[-overlap_tokens:])
                current_texts = [overlap_text]
                current_tokens = list(current_tokens[-overlap_tokens:])
            else:
                current_texts = []
                current_tokens = []

        current_texts.append(paragraph)
        current_tokens.extend(para_tokens)

        # If a single paragraph exceeds target, force-split it.
        while len(current_tokens) > target_tokens:
            split_tokens = current_tokens[:target_tokens]
            chunk_text = enc.decode(split_tokens)
            chunks.append({
                "text": chunk_text,
                "token_count": len(split_tokens),
                "metadata": {"chunk_method": "token_split"},
            })

            remaining_start = max(0, target_tokens - overlap_tokens)
            current_tokens = list(current_tokens[remaining_start:])
            current_texts = [enc.decode(current_tokens)]

    # Flush remaining content.
    if current_tokens:
        chunk_text = "\n\n".join(current_texts)
        chunks.append({
            "text": chunk_text,
            "token_count": len(current_tokens),
            "metadata": {"chunk_method": "paragraph_boundary"},
        })

    return chunks


async def _generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI.

    Args:
        texts: List of text strings to embed.

    Returns:
        List of embedding vectors (1536 dimensions each).
    """
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not configured — using zero vectors")
        return [[0.0] * EMBEDDING_DIMENSION for _ in texts]

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # OpenAI supports batching up to 2048 inputs. Process in batches.
    all_embeddings: list[list[float]] = []
    batch_size = 100

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
        )
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings


async def generate_query_embedding(query: str) -> list[float]:
    """Generate an embedding for a single query string.

    Args:
        query: The user's question text.

    Returns:
        A 1536-dimension embedding vector.
    """
    embeddings = await _generate_embeddings([query])
    return embeddings[0]

