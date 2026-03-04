"""FeatureRequest and FeatureVote models — workspace feature voting board."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


FEATURE_REQUEST_STATUSES = (
    "open",
    "under_review",
    "planned",
    "in_progress",
    "completed",
    "declined",
)


class FeatureVote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single upvote by a user on a feature request (one per user per request)."""

    __tablename__ = "feature_votes"
    __table_args__ = (
        UniqueConstraint("feature_request_id", "user_id", name="uq_vote_per_user"),
    )

    feature_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feature_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821

    def __repr__(self) -> str:
        return f"<FeatureVote request={self.feature_request_id} user={self.user_id}>"


class FeatureRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A feature request submitted by a workspace member, votable by all members."""

    __tablename__ = "feature_requests"

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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="open"
    )
    vote_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )

    author: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821
    votes: Mapped[list[FeatureVote]] = relationship(
        "FeatureVote",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<FeatureRequest id={self.id} title={self.title!r} votes={self.vote_count}>"
