"""add workspace_api_keys table and project_brief column

Revision ID: g8h9i0j1k2l3
Revises: f7g8h9i0j1k2
Create Date: 2026-03-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g8h9i0j1k2l3"
down_revision: Union[str, Sequence[str], None] = "f7g8h9i0j1k2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # workspace_api_keys table
    op.create_table(
        "workspace_api_keys",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("service", sa.String(length=50), nullable=False, comment="e.g. openai, anthropic"),
        sa.Column(
            "encrypted_key", sa.Text(), nullable=False,
            comment="AES-256-GCM ciphertext (base64)",
        ),
        sa.Column(
            "key_hint", sa.String(length=20), nullable=False,
            comment="Masked display hint e.g. sk-...xK2a",
        ),
        sa.Column(
            "label", sa.String(length=100), nullable=True,
            comment="Optional user-friendly label",
        ),
        sa.Column("added_by", sa.UUID(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"]),
    )
    op.create_index(
        "ix_workspace_api_keys_workspace_service",
        "workspace_api_keys",
        ["workspace_id", "service"],
        unique=True,
    )

    # project_brief column on workspaces
    op.add_column(
        "workspaces",
        sa.Column(
            "project_brief", sa.Text(), nullable=True,
            comment="Optional project description injected into AI system prompts",
        ),
    )


def downgrade() -> None:
    op.drop_column("workspaces", "project_brief")
    op.drop_index("ix_workspace_api_keys_workspace_service", table_name="workspace_api_keys")
    op.drop_table("workspace_api_keys")
