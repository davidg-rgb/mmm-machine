"""Add FK cascade actions, partial unique index on invitations, composite index

Revision ID: 004_fk_cascades
Revises: 003_invitations
Create Date: 2026-02-12
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "004_fk_cascades"
down_revision: Union[str, None] = "003_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Composite index on invitations (workspace_id, status) ---
    op.create_index(
        "ix_invitations_workspace_status",
        "invitations",
        ["workspace_id", "status"],
    )

    # --- Partial unique index: one pending invite per email per workspace ---
    op.execute(
        "CREATE UNIQUE INDEX uq_invitations_workspace_email_pending "
        "ON invitations (workspace_id, email) "
        "WHERE status = 'pending'"
    )

    # --- FK cascade: invitations.workspace_id → CASCADE ---
    op.drop_constraint(
        "invitations_workspace_id_fkey", "invitations", type_="foreignkey"
    )
    op.create_foreign_key(
        "invitations_workspace_id_fkey",
        "invitations",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- FK cascade: invitations.invited_by → CASCADE ---
    op.drop_constraint(
        "invitations_invited_by_fkey", "invitations", type_="foreignkey"
    )
    op.create_foreign_key(
        "invitations_invited_by_fkey",
        "invitations",
        "users",
        ["invited_by"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- FK: users.workspace_id → RESTRICT ---
    op.drop_constraint(
        "users_workspace_id_fkey", "users", type_="foreignkey"
    )
    op.create_foreign_key(
        "users_workspace_id_fkey",
        "users",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # --- FK cascade: datasets.workspace_id → CASCADE ---
    op.drop_constraint(
        "datasets_workspace_id_fkey", "datasets", type_="foreignkey"
    )
    op.create_foreign_key(
        "datasets_workspace_id_fkey",
        "datasets",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- FK: datasets.uploaded_by → SET NULL (make nullable) ---
    op.alter_column("datasets", "uploaded_by", nullable=True)
    op.drop_constraint(
        "datasets_uploaded_by_fkey", "datasets", type_="foreignkey"
    )
    op.create_foreign_key(
        "datasets_uploaded_by_fkey",
        "datasets",
        "users",
        ["uploaded_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- FK cascade: model_runs.workspace_id → CASCADE ---
    op.drop_constraint(
        "model_runs_workspace_id_fkey", "model_runs", type_="foreignkey"
    )
    op.create_foreign_key(
        "model_runs_workspace_id_fkey",
        "model_runs",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- FK cascade: model_runs.dataset_id → CASCADE ---
    op.drop_constraint(
        "model_runs_dataset_id_fkey", "model_runs", type_="foreignkey"
    )
    op.create_foreign_key(
        "model_runs_dataset_id_fkey",
        "model_runs",
        "datasets",
        ["dataset_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- FK: model_runs.created_by → SET NULL (make nullable) ---
    op.alter_column("model_runs", "created_by", nullable=True)
    op.drop_constraint(
        "model_runs_created_by_fkey", "model_runs", type_="foreignkey"
    )
    op.create_foreign_key(
        "model_runs_created_by_fkey",
        "model_runs",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Reverse FK changes (back to no cascade, NOT NULL)
    op.drop_constraint("model_runs_created_by_fkey", "model_runs", type_="foreignkey")
    op.create_foreign_key("model_runs_created_by_fkey", "model_runs", "users", ["created_by"], ["id"])
    op.alter_column("model_runs", "created_by", nullable=False)

    op.drop_constraint("model_runs_dataset_id_fkey", "model_runs", type_="foreignkey")
    op.create_foreign_key("model_runs_dataset_id_fkey", "model_runs", "datasets", ["dataset_id"], ["id"])

    op.drop_constraint("model_runs_workspace_id_fkey", "model_runs", type_="foreignkey")
    op.create_foreign_key("model_runs_workspace_id_fkey", "model_runs", "workspaces", ["workspace_id"], ["id"])

    op.drop_constraint("datasets_uploaded_by_fkey", "datasets", type_="foreignkey")
    op.create_foreign_key("datasets_uploaded_by_fkey", "datasets", "users", ["uploaded_by"], ["id"])
    op.alter_column("datasets", "uploaded_by", nullable=False)

    op.drop_constraint("datasets_workspace_id_fkey", "datasets", type_="foreignkey")
    op.create_foreign_key("datasets_workspace_id_fkey", "datasets", "workspaces", ["workspace_id"], ["id"])

    op.drop_constraint("users_workspace_id_fkey", "users", type_="foreignkey")
    op.create_foreign_key("users_workspace_id_fkey", "users", "workspaces", ["workspace_id"], ["id"])

    op.drop_constraint("invitations_invited_by_fkey", "invitations", type_="foreignkey")
    op.create_foreign_key("invitations_invited_by_fkey", "invitations", "users", ["invited_by"], ["id"])

    op.drop_constraint("invitations_workspace_id_fkey", "invitations", type_="foreignkey")
    op.create_foreign_key("invitations_workspace_id_fkey", "invitations", "workspaces", ["workspace_id"], ["id"])

    op.execute("DROP INDEX uq_invitations_workspace_email_pending")
    op.drop_index("ix_invitations_workspace_status", table_name="invitations")
