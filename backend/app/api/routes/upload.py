import io
import logging
import re
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.api.dependencies import get_current_user, require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.user import User
from app.schemas.dataset import (
    ColumnInfo,
    ColumnMapping,
    DatasetResponse,
    UpdateMappingRequest,
    UploadResponse,
    ValidationReport,
)
from app.services.data_transformer import DataTransformer
from app.services.data_validator import DataValidator
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/datasets", tags=["datasets"])
settings = get_settings()
limiter = Limiter(key_func=get_remote_address, enabled=settings.app_env != "test")

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
PREVIEW_ROWS = 10


def _get_file_extension(filename: str) -> str:
    if not filename:
        return ""
    dot_idx = filename.rfind(".")
    if dot_idx == -1:
        return ""
    return filename[dot_idx:].lower()


def _sanitize_filename(filename: str) -> str:
    """Remove path separators and control characters from filename."""
    sanitized = re.sub(r'[/\\<>:"|?*\x00-\x1f]', '_', filename)
    if len(sanitized) > 255:
        ext = _get_file_extension(sanitized)
        sanitized = sanitized[:255 - len(ext)] + ext
    return sanitized


def _parse_file(contents: bytes, filename: str) -> pd.DataFrame:
    """Parse uploaded file into a DataFrame."""
    ext = _get_file_extension(filename)
    if ext == ".csv":
        # Try common encodings
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                return pd.read_csv(io.BytesIO(contents), encoding=encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode CSV file. Try saving as UTF-8.")
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(io.BytesIO(contents))
    else:
        raise ValueError(f"Unsupported file type: {ext}")


_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _check_csv_injection(df: pd.DataFrame) -> pd.DataFrame:
    """Check for potential CSV formula injection and sanitize column names.

    Logs warnings for suspicious cell values but does not block the upload,
    since marketing data commonly uses these characters. Leading '=' in
    column names is stripped as a precaution.
    """
    # Sanitize column names: strip leading '='
    renamed = {}
    for col in df.columns:
        col_str = str(col)
        if col_str.startswith("="):
            clean = col_str.lstrip("=")
            renamed[col] = clean
            logger.warning("CSV injection: column name '%s' started with '=', renamed to '%s'", col_str, clean)
    if renamed:
        df = df.rename(columns=renamed)

    # Scan string cells for formula prefixes (warn only)
    suspect_count = 0
    for col in df.select_dtypes(include=["object"]).columns:
        for val in df[col].dropna().head(200):
            if isinstance(val, str) and val and val[0] in _FORMULA_PREFIXES:
                suspect_count += 1
    if suspect_count:
        logger.warning(
            "CSV injection check: %d cell(s) start with formula-like characters (%s). "
            "Upload allowed; values are stored as-is.",
            suspect_count,
            ", ".join(_FORMULA_PREFIXES[:4]),
        )

    return df


def _build_column_info(df: pd.DataFrame) -> list[ColumnInfo]:
    """Build column metadata for the upload response."""
    columns = []
    for col in df.columns:
        sample = df[col].dropna().head(5).tolist()
        # Convert numpy types to native Python types for JSON serialization
        sample = [v.item() if hasattr(v, "item") else v for v in sample]
        columns.append(
            ColumnInfo(
                name=str(col),
                dtype=str(df[col].dtype),
                null_count=int(df[col].isna().sum()),
                sample_values=sample,
            )
        )
    return columns


def _dataset_to_response(d: Dataset) -> DatasetResponse:
    return DatasetResponse(
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


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def upload_dataset(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin", "member")),
    db: AsyncSession = Depends(get_db),
):
    # Sanitize and validate filename
    safe_filename = _sanitize_filename(file.filename or "upload")
    ext = _get_file_extension(safe_filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{ext}'. Allowed: CSV, XLSX.",
        )

    # Read file contents
    contents = await file.read()

    # Validate file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Parse the file
    try:
        df = _parse_file(contents, safe_filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        logger.exception("Failed to parse uploaded file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse file. Ensure it is a valid CSV or Excel file.",
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file contains no data rows.",
        )

    # Check for CSV formula injection (warn + sanitize column names)
    df = _check_csv_injection(df)

    # Upload raw file to S3
    dataset_id = str(uuid.uuid4())
    s3_key = f"datasets/{current_user.workspace_id}/{dataset_id}/{safe_filename}"
    content_type = "text/csv" if ext == ".csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    try:
        storage = StorageService()
        storage.upload_file(s3_key, contents, content_type)
    except Exception:
        logger.exception("Failed to upload file to S3")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to store file. Please try again.",
        )

    # Also store as CSV for processing (if Excel, convert to CSV)
    csv_key = f"datasets/{current_user.workspace_id}/{dataset_id}/data.csv"
    csv_buffer = io.BytesIO()
    df.to_csv(csv_buffer, index=False)
    csv_bytes = csv_buffer.getvalue()
    storage.upload_file(csv_key, csv_bytes, "text/csv")

    # Auto-detect column mapping
    transformer = DataTransformer()
    auto_mapping_dict = transformer.auto_detect_columns(df)

    # Build auto_mapping response (only if we detected the required fields)
    auto_mapping = None
    if auto_mapping_dict.get("date_column") and auto_mapping_dict.get("target_column"):
        try:
            auto_mapping = ColumnMapping(
                date_column=auto_mapping_dict["date_column"],
                target_column=auto_mapping_dict["target_column"],
                media_columns={
                    k: {"channel_name": v["channel_name"], "spend_type": v["spend_type"]}
                    for k, v in auto_mapping_dict.get("media_columns", {}).items()
                },
                control_columns=auto_mapping_dict.get("control_columns", []),
            )
        except Exception:
            logger.warning("Auto-mapping construction failed, returning None")
            auto_mapping = None

    # Build column info
    columns = _build_column_info(df)

    # Build preview rows
    preview = df.head(PREVIEW_ROWS).fillna("").to_dict(orient="records")
    # Ensure JSON-serializable values
    for row in preview:
        for k, v in row.items():
            if hasattr(v, "item"):
                row[k] = v.item()

    # Detect date range
    date_col = auto_mapping_dict.get("date_column")
    date_start = None
    date_end = None
    if date_col and date_col in df.columns:
        dates = pd.to_datetime(df[date_col], errors="coerce").dropna()
        if len(dates) > 0:
            date_start = dates.min().date()
            date_end = dates.max().date()

    # Create dataset record
    dataset = Dataset(
        id=dataset_id,
        workspace_id=current_user.workspace_id,
        uploaded_by=current_user.id,
        filename=safe_filename,
        s3_key=csv_key,
        row_count=len(df),
        date_range_start=date_start,
        date_range_end=date_end,
        column_mapping=auto_mapping.model_dump() if auto_mapping else None,
        status="uploaded",
    )
    db.add(dataset)
    await db.flush()

    return UploadResponse(
        dataset_id=dataset.id,
        filename=dataset.filename,
        row_count=len(df),
        columns=columns,
        preview_rows=preview,
        auto_mapping=auto_mapping,
    )


@router.get("/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return headers and first 10 rows of a dataset CSV."""
    dataset = await _get_dataset(dataset_id, current_user.workspace_id, db)

    try:
        storage = StorageService()
        df = storage.download_csv(dataset.s3_key)
    except Exception:
        logger.exception("Failed to download dataset from S3 for preview")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to load dataset from storage.",
        )

    headers = [str(c) for c in df.columns]
    preview_df = df.head(PREVIEW_ROWS).fillna("")
    rows = []
    for _, row in preview_df.iterrows():
        rows.append([
            str(v.item()) if hasattr(v, "item") else str(v)
            for v in row
        ])

    return {
        "headers": headers,
        "rows": rows,
        "total_rows": len(df),
    }


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
    return [_dataset_to_response(d) for d in result.scalars().all()]


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset(dataset_id, current_user.workspace_id, db)
    return _dataset_to_response(dataset)


@router.put("/{dataset_id}/mapping", response_model=DatasetResponse)
async def update_mapping(
    dataset_id: str,
    body: UpdateMappingRequest,
    current_user: User = Depends(require_role("admin", "member")),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset(dataset_id, current_user.workspace_id, db)
    dataset.column_mapping = body.column_mapping.model_dump()
    await db.flush()
    return _dataset_to_response(dataset)


@router.post("/{dataset_id}/validate", response_model=ValidationReport)
@limiter.limit("20/minute")
async def validate_dataset(
    request: Request,
    dataset_id: str,
    current_user: User = Depends(require_role("admin", "member")),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset(dataset_id, current_user.workspace_id, db)

    if not dataset.column_mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Column mapping must be set before validation.",
        )

    # Load data from S3
    try:
        storage = StorageService()
        df = storage.download_csv(dataset.s3_key)
    except Exception:
        logger.exception("Failed to download dataset from S3")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to load dataset from storage.",
        )

    # Run validation
    validator = DataValidator()
    report = validator.validate(df, dataset.column_mapping)

    # Store report and update status
    dataset.validation_report = report
    dataset.status = "validated" if report["is_valid"] else "validation_error"

    # Update date range and row count from summary
    summary = report.get("data_summary", {})
    dataset.row_count = summary.get("row_count", dataset.row_count)
    if summary.get("date_range_start"):
        try:
            dataset.date_range_start = pd.to_datetime(summary["date_range_start"]).date()
        except Exception:
            pass
    if summary.get("date_range_end"):
        try:
            dataset.date_range_end = pd.to_datetime(summary["date_range_end"]).date()
        except Exception:
            pass

    await db.flush()

    return ValidationReport(**report)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(require_role("admin", "member")),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset(dataset_id, current_user.workspace_id, db)

    # Delete all S3 files under the dataset prefix (raw upload + converted CSV)
    try:
        storage = StorageService()
        prefix = f"datasets/{dataset.workspace_id}/{dataset_id}/"
        storage.delete_prefix(prefix)
    except Exception:
        logger.warning(f"Failed to delete S3 files for dataset {dataset_id}")

    await db.delete(dataset)


async def _get_dataset(dataset_id: str, workspace_id: str, db: AsyncSession) -> Dataset:
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.workspace_id == workspace_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset
