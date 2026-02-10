"""Add composite indexes for common query patterns

Revision ID: 002_add_indexes
Revises: 001_initial
Create Date: 2026-02-10
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002_add_indexes"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Model runs: composite index for workspace + status filtering
    op.create_index(
        "ix_model_runs_workspace_status",
        "model_runs",
        ["workspace_id", "status"],
    )
    # Model runs: index on dataset_id for FK lookups
    op.create_index(
        "ix_model_runs_dataset_id",
        "model_runs",
        ["dataset_id"],
    )
    # Datasets: composite index for workspace + status
    op.create_index(
        "ix_datasets_workspace_status",
        "datasets",
        ["workspace_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_datasets_workspace_status", table_name="datasets")
    op.drop_index("ix_model_runs_dataset_id", table_name="model_runs")
    op.drop_index("ix_model_runs_workspace_status", table_name="model_runs")
