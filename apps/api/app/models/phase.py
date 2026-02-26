"""Phase model — a project phase containing ordered milestones."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Phase(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A named phase within a workspace's project (e.g. 'Phase 1: Blueprint')."""

    __tablename__ = "phases"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Relationships
    milestones: Mapped[list["Milestone"]] = relationship(  # noqa: F821
        "Milestone",
        back_populates="phase",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Milestone.sort_order",
    )

    def __repr__(self) -> str:
        return f"<Phase id={self.id} title={self.title!r}>"

