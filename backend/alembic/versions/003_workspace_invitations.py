"""Add invitations table for workspace member invitations

Revision ID: 003_invitations
Revises: 002_add_indexes
Create Date: 2026-02-11
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "003_invitations"
down_revision: Union[str, None] = "002_add_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("token", sa.String(36), nullable=False, unique=True),
        sa.Column("invited_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_invitations_token", "invitations", ["token"], unique=True)
    op.create_index("ix_invitations_workspace_id", "invitations", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_invitations_workspace_id", table_name="invitations")
    op.drop_index("ix_invitations_token", table_name="invitations")
    op.drop_table("invitations")
