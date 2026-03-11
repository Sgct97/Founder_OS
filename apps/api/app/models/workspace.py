"""Workspace model — shared team container for all FoundersForge data."""

from decimal import Decimal

from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A workspace groups co-founders and all their shared data."""

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    invite_code: Mapped[str | None] = mapped_column(
        String(20), unique=True, nullable=True
    )
    commitment_hours: Mapped[Decimal | None] = mapped_column(
        Numeric(3, 1), nullable=True
    )
    project_brief: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Optional project description injected into AI system prompts"
    )

    # Relationships
    members: Mapped[list["User"]] = relationship(  # noqa: F821
        "User", back_populates="workspace", lazy="selectin"
    )
    api_keys: Mapped[list["WorkspaceApiKey"]] = relationship(  # noqa: F821
        "WorkspaceApiKey", back_populates="workspace", lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Workspace id={self.id} name={self.name!r}>"

