"""add milestone_id to conversations

Revision ID: f7g8h9i0j1k2
Revises: e6f7g8h9i0j1
Create Date: 2026-03-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7g8h9i0j1k2"
down_revision: Union[str, Sequence[str], None] = "e6f7g8h9i0j1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("milestone_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_conversations_milestone_id",
        "conversations",
        "milestones",
        ["milestone_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_conversations_milestone_id",
        "conversations",
        ["milestone_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_milestone_id", table_name="conversations")
    op.drop_constraint("fk_conversations_milestone_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "milestone_id")
