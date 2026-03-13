"""WorkspaceMember model — tracks which users belong to which workspaces."""

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkspaceMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Many-to-many link between users and workspaces.

    A user can be a member of multiple workspaces. The user's
    ``workspace_id`` column tracks which workspace is currently active.
    """

    __tablename__ = "workspace_members"
    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", name="uq_workspace_member"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="member",
        comment="owner | admin | member",
    )

    user: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821
    workspace: Mapped["Workspace"] = relationship("Workspace", lazy="selectin")  # noqa: F821

    def __repr__(self) -> str:
        return f"<WorkspaceMember user={self.user_id} workspace={self.workspace_id} role={self.role!r}>"
