"""Milestone model — a trackable item within a phase."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Status constants — used for validation in schemas and services.
MILESTONE_STATUSES = ("not_started", "in_progress", "completed")


class Milestone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single milestone within a phase (e.g. 'Set up Auth0')."""

    __tablename__ = "milestones"

    phase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("phases.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="not_started"
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    phase: Mapped["Phase"] = relationship(  # noqa: F821
        "Phase", back_populates="milestones", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Milestone id={self.id} title={self.title!r} status={self.status!r}>"

