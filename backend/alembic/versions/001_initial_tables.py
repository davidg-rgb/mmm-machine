"""Initial tables: workspaces, users, datasets, model_runs

Revision ID: 001_initial
Revises:
Create Date: 2026-02-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Workspaces
    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="admin"),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # Datasets
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("s3_key", sa.String(512), nullable=False),
        sa.Column("row_count", sa.Integer, nullable=True),
        sa.Column("date_range_start", sa.Date, nullable=True),
        sa.Column("date_range_end", sa.Date, nullable=True),
        sa.Column("frequency", sa.String(20), nullable=False, server_default="weekly"),
        sa.Column("column_mapping", JSONB, nullable=True),
        sa.Column("validation_report", JSONB, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_datasets_workspace_id", "datasets", ["workspace_id"])
    op.create_index("ix_datasets_workspace_created", "datasets", ["workspace_id", "created_at"])
    op.create_index("ix_datasets_column_mapping", "datasets", ["column_mapping"], postgresql_using="gin")

    # Model Runs
    op.create_table(
        "model_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id"), nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("config", JSONB, nullable=False),
        sa.Column("results", JSONB, nullable=True),
        sa.Column("model_artifact_s3_key", sa.String(512), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_model_runs_workspace_id", "model_runs", ["workspace_id"])
    op.create_index("ix_model_runs_workspace_created", "model_runs", ["workspace_id", "created_at"])
    op.create_index("ix_model_runs_results", "model_runs", ["results"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_table("model_runs")
    op.drop_table("datasets")
    op.drop_table("users")
    op.drop_table("workspaces")
