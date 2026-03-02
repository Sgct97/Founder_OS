"""MilestoneAttachment model — file attached to a milestone."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MilestoneAttachment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A supporting document/file attached to a specific milestone."""

    __tablename__ = "milestone_attachments"

    milestone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Relationships
    milestone: Mapped["Milestone"] = relationship(  # noqa: F821
        "Milestone", back_populates="attachments", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<MilestoneAttachment id={self.id} filename={self.filename!r}>"

