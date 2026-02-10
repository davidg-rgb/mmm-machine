from pydantic import BaseModel


class ModelRunConfig(BaseModel):
    dataset_id: str
    name: str | None = None
    adstock_type: str = "geometric"
    saturation_type: str = "logistic"
    n_samples: int = 2000
    n_chains: int = 4
    target_accept: float = 0.9
    yearly_seasonality: bool = True
    mode: str = "quick"


class ModelRunResponse(BaseModel):
    id: str
    workspace_id: str
    dataset_id: str
    name: str
    status: str
    progress: int
    config: dict
    results: dict | None
    error_message: str | None
    started_at: str | None
    completed_at: str | None
    created_at: str

    model_config = {"from_attributes": True}


class ProgressEvent(BaseModel):
    status: str
    progress: int
    message: str
    stage: str
    eta_seconds: int | None = None
