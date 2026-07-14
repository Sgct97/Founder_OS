"""Client delivery Project — a job inside a workspace."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A client job/engagement scoped to a single workspace."""

    __tablename__ = "projects"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    creator: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r}>"
