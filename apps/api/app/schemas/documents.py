"""Pydantic schemas for document upload and knowledge base endpoints."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────


class DocumentStatus(str, Enum):
    """Processing status for an uploaded document."""

    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentFileType(str, Enum):
    """Supported file types for upload."""

    PDF = "pdf"
    MARKDOWN = "md"
    TEXT = "txt"
    CSV = "csv"
    JSON = "json"
    HTML = "html"
    HTM = "htm"
    YAML = "yaml"
    YML = "yml"
    LOG = "log"
    RST = "rst"
    XML = "xml"


# ── Response Schemas ─────────────────────────────────────────────


class DocumentUploaderResponse(BaseModel):
    """Minimal uploader info embedded in document responses."""

    id: uuid.UUID
    display_name: str

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    """Public representation of a document in the knowledge base."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    uploaded_by: uuid.UUID
    title: str
    file_size_bytes: int
    file_type: str
    chunk_count: int | None
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetailResponse(BaseModel):
    """Detailed document view with uploader info."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    uploader: DocumentUploaderResponse
    title: str
    file_path: str
    file_size_bytes: int
    file_type: str
    chunk_count: int | None
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentStatusResponse(BaseModel):
    """Lightweight status check for polling during processing."""

    id: uuid.UUID
    status: str
    chunk_count: int | None
    error_message: str | None

    model_config = {"from_attributes": True}

