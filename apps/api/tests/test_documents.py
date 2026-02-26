"""Tests for document upload and knowledge base endpoints."""

import io
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.dependencies import get_current_user
from app.main import app
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.models.workspace import Workspace
from app.services.documents import _chunk_text
from tests.conftest import TestSessionLocal


# ── Helpers ──────────────────────────────────────────────────────


@pytest.fixture
async def authed_client(client: AsyncClient, tmp_path: Path) -> AsyncClient:
    """Client with auth overridden + test user in a workspace.

    Also patches upload_dir to tmp_path to avoid polluting the filesystem,
    and stubs out the background process_document to avoid event-loop issues.
    """
    async with TestSessionLocal() as session:
        workspace = Workspace(name="Docs WS")
        session.add(workspace)
        await session.flush()

        user = User(
            email="docuser@example.com",
            display_name="Doc User",
            supabase_uid="sb-doc-uid",
            workspace_id=workspace.id,
        )
        session.add(user)
        await session.commit()

        user_id = user.id

    async def _override() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override

    with (
        patch("app.services.documents.settings") as mock_settings,
        # Stub out the background task to prevent it from using the production
        # database engine, which causes event-loop issues in tests.  The
        # process_document function is tested directly in its own test cases.
        patch("app.services.documents.process_document", new_callable=AsyncMock),
    ):
        mock_settings.upload_dir = str(tmp_path)
        mock_settings.openai_api_key = ""
        yield client

    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def authed_client_no_workspace(client: AsyncClient) -> AsyncClient:
    """Client with auth overridden — user without a workspace."""
    async with TestSessionLocal() as session:
        user = User(
            email="orphan-doc@example.com",
            display_name="Orphan Doc",
            supabase_uid="sb-orphan-doc-uid",
            workspace_id=None,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    async def _override() -> User:
        async with TestSessionLocal() as s:
            r = await s.execute(select(User).where(User.id == user_id))
            return r.scalar_one()

    app.dependency_overrides[get_current_user] = _override
    yield client
    app.dependency_overrides.pop(get_current_user, None)


def _make_file(content: bytes = b"Test document content.", filename: str = "test.txt"):
    """Create a file-like object for upload testing."""
    return ("file", (filename, io.BytesIO(content), "text/plain"))


# ── Upload Tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_document_txt(authed_client: AsyncClient) -> None:
    """POST /api/v1/documents should accept a text file and return 201."""
    response = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"Hello world", "test.txt")],
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "test"
    assert data["file_type"] == "txt"
    assert data["status"] == "queued"
    assert data["file_size_bytes"] == 11
    assert "id" in data


@pytest.mark.asyncio
async def test_upload_document_md(authed_client: AsyncClient) -> None:
    """Upload a markdown file should work."""
    response = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"# Hello\n\nContent here", "readme.md")],
    )
    assert response.status_code == 201
    assert response.json()["file_type"] == "md"
    assert response.json()["title"] == "readme"


@pytest.mark.asyncio
async def test_upload_document_pdf(authed_client: AsyncClient) -> None:
    """Upload a PDF file should be accepted (status queued)."""
    # Minimal PDF-like content (just for upload acceptance, not parsing).
    pdf_content = b"%PDF-1.4 minimal test content"
    response = await authed_client.post(
        "/api/v1/documents",
        files=[("file", ("report.pdf", io.BytesIO(pdf_content), "application/pdf"))],
    )
    assert response.status_code == 201
    assert response.json()["file_type"] == "pdf"


@pytest.mark.asyncio
async def test_upload_unsupported_type(authed_client: AsyncClient) -> None:
    """Uploading a .docx file should return 400."""
    response = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"content", "test.docx")],
    )
    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_empty_file(authed_client: AsyncClient) -> None:
    """Uploading an empty file should return 400."""
    response = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"", "empty.txt")],
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_no_workspace(authed_client_no_workspace: AsyncClient) -> None:
    """Uploading without a workspace should return 400."""
    response = await authed_client_no_workspace.post(
        "/api/v1/documents",
        files=[_make_file()],
    )
    assert response.status_code == 400
    assert "workspace" in response.json()["detail"].lower()


# ── List Tests ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_documents_empty(authed_client: AsyncClient) -> None:
    """GET /api/v1/documents should return empty list when no documents."""
    response = await authed_client.get("/api/v1/documents")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_documents_after_upload(authed_client: AsyncClient) -> None:
    """Uploaded documents should appear in the list."""
    await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"Content A", "doc-a.txt")],
    )
    await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"Content B", "doc-b.txt")],
    )

    response = await authed_client.get("/api/v1/documents")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


# ── Get / Detail Tests ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_document_detail(authed_client: AsyncClient) -> None:
    """GET /api/v1/documents/{id} should return document details."""
    upload_resp = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"Detail test", "detail.txt")],
    )
    doc_id = upload_resp.json()["id"]

    response = await authed_client.get(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "detail"
    assert "uploader" in data
    assert data["uploader"]["display_name"] == "Doc User"


@pytest.mark.asyncio
async def test_get_document_not_found(authed_client: AsyncClient) -> None:
    """GET on nonexistent document should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.get(f"/api/v1/documents/{fake_id}")
    assert response.status_code == 404


# ── Status Tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_document_status(authed_client: AsyncClient) -> None:
    """GET /api/v1/documents/{id}/status should return status info."""
    upload_resp = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"Status test", "status.txt")],
    )
    doc_id = upload_resp.json()["id"]

    response = await authed_client.get(f"/api/v1/documents/{doc_id}/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert data["id"] == doc_id


# ── Delete Tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_document(authed_client: AsyncClient) -> None:
    """DELETE /api/v1/documents/{id} should remove the document (204)."""
    upload_resp = await authed_client.post(
        "/api/v1/documents",
        files=[_make_file(b"To delete", "delete-me.txt")],
    )
    doc_id = upload_resp.json()["id"]

    response = await authed_client.delete(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 204

    # Verify it's gone.
    list_resp = await authed_client.get("/api/v1/documents")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_document_not_found(authed_client: AsyncClient) -> None:
    """DELETE on nonexistent document should return 404."""
    fake_id = str(uuid.uuid4())
    response = await authed_client.delete(f"/api/v1/documents/{fake_id}")
    assert response.status_code == 404


# ── Auth Edge Cases ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_documents_without_auth_returns_403(client: AsyncClient) -> None:
    """GET /api/v1/documents without token should return 403."""
    response = await client.get("/api/v1/documents")
    assert response.status_code == 403


# ── Chunking Unit Tests ──────────────────────────────────────────


def test_chunk_text_basic() -> None:
    """Basic text chunking should produce at least one chunk."""
    text = "This is a test paragraph.\n\nThis is another paragraph."
    chunks = _chunk_text(text)
    assert len(chunks) >= 1
    assert all("text" in c for c in chunks)
    assert all("token_count" in c for c in chunks)
    assert all(c["token_count"] > 0 for c in chunks)


def test_chunk_text_long_document() -> None:
    """Long text should be split into multiple chunks."""
    # Create a document with ~2000 tokens worth of text.
    text = "\n\n".join([f"Paragraph {i}. " + "word " * 100 for i in range(20)])
    chunks = _chunk_text(text, target_tokens=512, overlap_tokens=50)
    assert len(chunks) > 1


def test_chunk_text_empty() -> None:
    """Empty text should produce no chunks."""
    chunks = _chunk_text("")
    assert len(chunks) == 0


def test_chunk_text_single_paragraph() -> None:
    """A short single paragraph should be one chunk."""
    chunks = _chunk_text("Hello world, this is a short document.")
    assert len(chunks) == 1
    assert "Hello world" in chunks[0]["text"]


# ── Model Repr Tests ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_document_repr(client: AsyncClient) -> None:
    """Document.__repr__ should contain title and status."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="repr-doc@example.com",
            display_name="Repr",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()
        doc = Document(
            workspace_id=ws.id,
            uploaded_by=user.id,
            title="Test Doc",
            file_path="/tmp/test.txt",
            file_size_bytes=100,
            file_type="txt",
            status="queued",
        )
        session.add(doc)
        await session.flush()
        r = repr(doc)
        assert "Test Doc" in r
        assert "queued" in r


@pytest.mark.asyncio
async def test_document_chunk_repr(client: AsyncClient) -> None:
    """DocumentChunk.__repr__ should contain document_id and chunk_index."""
    async with TestSessionLocal() as session:
        ws = Workspace(name="Repr Chunk WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="repr-chunk@example.com",
            display_name="Repr Chunk",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()
        doc = Document(
            workspace_id=ws.id,
            uploaded_by=user.id,
            title="Chunk Doc",
            file_path="/tmp/chunk.txt",
            file_size_bytes=50,
            file_type="txt",
        )
        session.add(doc)
        await session.flush()
        chunk = DocumentChunk(
            document_id=doc.id,
            chunk_index=0,
            content="Test chunk",
            token_count=2,
        )
        session.add(chunk)
        await session.flush()
        r = repr(chunk)
        assert "DocumentChunk" in r
        assert "chunk_index=0" in r


# ── Process Document Tests ───────────────────────────────────────


@pytest.mark.asyncio
async def test_process_document_success(client: AsyncClient, tmp_path: Path) -> None:
    """process_document should parse, chunk, embed, and mark status as ready."""
    from app.services.documents import process_document

    # Create test document on disk and in DB.
    async with TestSessionLocal() as session:
        ws = Workspace(name="Process WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="process@example.com",
            display_name="Process User",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()

        file_path = tmp_path / "test.txt"
        file_path.write_text("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.")

        doc = Document(
            workspace_id=ws.id,
            uploaded_by=user.id,
            title="Process Test",
            file_path=str(file_path),
            file_size_bytes=100,
            file_type="txt",
            status="queued",
        )
        session.add(doc)
        await session.commit()
        doc_id = doc.id

    # Mock the parsing and embedding to avoid external dependencies.
    with (
        patch("app.services.documents._parse_file") as mock_parse,
        patch("app.services.documents._generate_embeddings") as mock_embed,
    ):
        mock_parse.return_value = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        mock_embed.return_value = [[0.1] * 1536, [0.2] * 1536, [0.3] * 1536]

        await process_document(doc_id)

    # Verify document status is "ready".
    async with TestSessionLocal() as session:
        result = await session.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one()
        assert doc.status == "ready"
        assert doc.chunk_count is not None
        assert doc.chunk_count > 0

        # Verify chunks were created.
        chunks_result = await session.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == doc_id)
        )
        chunks = list(chunks_result.scalars().all())
        assert len(chunks) > 0


@pytest.mark.asyncio
async def test_process_document_failure(client: AsyncClient, tmp_path: Path) -> None:
    """process_document should mark status as failed on error."""
    from app.services.documents import process_document

    async with TestSessionLocal() as session:
        ws = Workspace(name="Fail WS")
        session.add(ws)
        await session.flush()
        user = User(
            email="fail@example.com",
            display_name="Fail User",
            workspace_id=ws.id,
        )
        session.add(user)
        await session.flush()

        # Point to a nonexistent file.
        doc = Document(
            workspace_id=ws.id,
            uploaded_by=user.id,
            title="Fail Test",
            file_path="/nonexistent/file.txt",
            file_size_bytes=100,
            file_type="txt",
            status="queued",
        )
        session.add(doc)
        await session.commit()
        doc_id = doc.id

    await process_document(doc_id)

    # Verify document status is "failed".
    async with TestSessionLocal() as session:
        result = await session.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one()
        assert doc.status == "failed"
        assert doc.error_message is not None


@pytest.mark.asyncio
async def test_process_nonexistent_document(client: AsyncClient) -> None:
    """process_document with a nonexistent ID should not raise."""
    from app.services.documents import process_document

    fake_id = uuid.uuid4()
    # Should not raise — just logs and returns.
    await process_document(fake_id)

