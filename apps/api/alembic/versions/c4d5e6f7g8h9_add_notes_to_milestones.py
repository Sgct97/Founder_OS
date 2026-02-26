"""Add notes column to milestones table.

Revision ID: c4d5e6f7g8h9
Revises: b3c4d5e6f7a8
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c4d5e6f7g8h9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("milestones", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("milestones", "notes")

