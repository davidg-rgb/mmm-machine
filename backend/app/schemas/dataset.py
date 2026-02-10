from pydantic import BaseModel


class MediaColumnConfig(BaseModel):
    channel_name: str
    spend_type: str = "spend"


class ColumnMapping(BaseModel):
    date_column: str
    target_column: str
    media_columns: dict[str, MediaColumnConfig]
    control_columns: list[str] = []


class ColumnInfo(BaseModel):
    name: str
    dtype: str
    null_count: int
    sample_values: list


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    row_count: int
    columns: list[ColumnInfo]
    preview_rows: list[dict]
    auto_mapping: ColumnMapping | None = None


class ValidationItem(BaseModel):
    code: str
    message: str
    column: str | None = None
    severity: str


class DataSummary(BaseModel):
    row_count: int
    date_range_start: str
    date_range_end: str
    frequency: str
    media_channel_count: int
    control_variable_count: int
    total_media_spend: float
    avg_target_value: float

    model_config = {"extra": "ignore"}


class ValidationReport(BaseModel):
    is_valid: bool
    errors: list[ValidationItem]
    warnings: list[ValidationItem]
    suggestions: list[ValidationItem]
    data_summary: DataSummary

    model_config = {"extra": "ignore"}


class DatasetResponse(BaseModel):
    id: str
    workspace_id: str
    filename: str
    row_count: int | None
    date_range_start: str | None
    date_range_end: str | None
    frequency: str
    column_mapping: dict | None
    validation_report: dict | None
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class UpdateMappingRequest(BaseModel):
    column_mapping: ColumnMapping
