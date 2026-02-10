from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.schemas.dataset import (
    DatasetResponse,
    UploadResponse,
    UpdateMappingRequest,
    ValidationReport,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: Implement file upload to S3, parse CSV/Excel, return preview
    raise HTTPException(status_code=501, detail="Upload endpoint not yet implemented")


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset)
        .where(Dataset.workspace_id == current_user.workspace_id)
        .order_by(Dataset.created_at.desc())
    )
    datasets = result.scalars().all()
    return [
        DatasetResponse(
            id=d.id,
            workspace_id=d.workspace_id,
            filename=d.filename,
            row_count=d.row_count,
            date_range_start=d.date_range_start.isoformat() if d.date_range_start else None,
            date_range_end=d.date_range_end.isoformat() if d.date_range_end else None,
            frequency=d.frequency,
            column_mapping=d.column_mapping,
            validation_report=d.validation_report,
            status=d.status,
            created_at=d.created_at.isoformat(),
        )
        for d in datasets
    ]


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.workspace_id == current_user.workspace_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return DatasetResponse(
        id=dataset.id,
        workspace_id=dataset.workspace_id,
        filename=dataset.filename,
        row_count=dataset.row_count,
        date_range_start=dataset.date_range_start.isoformat() if dataset.date_range_start else None,
        date_range_end=dataset.date_range_end.isoformat() if dataset.date_range_end else None,
        frequency=dataset.frequency,
        column_mapping=dataset.column_mapping,
        validation_report=dataset.validation_report,
        status=dataset.status,
        created_at=dataset.created_at.isoformat(),
    )


@router.put("/{dataset_id}/mapping", response_model=DatasetResponse)
async def update_mapping(
    dataset_id: str,
    body: UpdateMappingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.workspace_id == current_user.workspace_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset.column_mapping = body.column_mapping.model_dump()
    await db.flush()

    return DatasetResponse(
        id=dataset.id,
        workspace_id=dataset.workspace_id,
        filename=dataset.filename,
        row_count=dataset.row_count,
        date_range_start=dataset.date_range_start.isoformat() if dataset.date_range_start else None,
        date_range_end=dataset.date_range_end.isoformat() if dataset.date_range_end else None,
        frequency=dataset.frequency,
        column_mapping=dataset.column_mapping,
        validation_report=dataset.validation_report,
        status=dataset.status,
        created_at=dataset.created_at.isoformat(),
    )


@router.post("/{dataset_id}/validate", response_model=ValidationReport)
async def validate_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: Run DataValidator service
    raise HTTPException(status_code=501, detail="Validation endpoint not yet implemented")


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.workspace_id == current_user.workspace_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    await db.delete(dataset)
