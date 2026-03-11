"""WorkspaceApiKey model — encrypted API keys scoped to a workspace."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkspaceApiKey(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An encrypted third-party API key belonging to a workspace.

    The raw key is never stored — only the AES-256-GCM ciphertext.
    A masked hint (e.g. 'sk-...xK2a') is kept for display purposes.
    """

    __tablename__ = "workspace_api_keys"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    service: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="e.g. openai, anthropic"
    )
    encrypted_key: Mapped[str] = mapped_column(
        Text, nullable=False, comment="AES-256-GCM ciphertext (base64)"
    )
    key_hint: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Masked display hint e.g. sk-...xK2a"
    )
    label: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="Optional user-friendly label"
    )
    added_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    workspace: Mapped["Workspace"] = relationship(  # noqa: F821
        "Workspace", back_populates="api_keys", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<WorkspaceApiKey id={self.id} service={self.service!r} hint={self.key_hint!r}>"
