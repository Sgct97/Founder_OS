"""DiaryEntry model — daily accountability log entry."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DiaryEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A daily log entry tied to a workspace, author, and optional milestone."""

    __tablename__ = "diary_entries"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="SET NULL"),
        nullable=True,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    hours_worked: Mapped[Decimal | None] = mapped_column(
        Numeric(4, 2), nullable=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    author: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821
    milestone: Mapped["Milestone | None"] = relationship(  # noqa: F821
        "Milestone", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<DiaryEntry id={self.id} date={self.entry_date} author_id={self.author_id}>"

