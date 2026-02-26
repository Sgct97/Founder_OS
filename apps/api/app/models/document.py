"""Document model — uploaded file record in the knowledge base."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Allowed file types for document uploads.
ALLOWED_FILE_TYPES = ("pdf", "md", "txt")

# Processing status values.
DOCUMENT_STATUSES = ("queued", "processing", "ready", "failed")


class Document(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An uploaded document belonging to a workspace's knowledge base."""

    __tablename__ = "documents"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    chunk_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="queued"
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    chunks: Mapped[list["DocumentChunk"]] = relationship(  # noqa: F821
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    uploader: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Document id={self.id} title={self.title!r} status={self.status!r}>"

