import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.model_run import ModelRun
from app.models.user import User
from app.schemas.model_run import ModelRunConfig, ModelRunResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])


@router.post("/run", response_model=ModelRunResponse, status_code=status.HTTP_201_CREATED)
async def create_model_run(
    body: ModelRunConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify dataset exists and belongs to workspace
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == body.dataset_id,
            Dataset.workspace_id == current_user.workspace_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.status != "validated":
        raise HTTPException(status_code=400, detail="Dataset must be validated before running a model")

    # Apply quick mode defaults
    config = body.model_dump()
    if body.mode == "quick":
        config["n_samples"] = 500
        config["n_chains"] = 2

    model_run = ModelRun(
        workspace_id=current_user.workspace_id,
        dataset_id=body.dataset_id,
        created_by=current_user.id,
        name=body.name or "Model Run",
        config=config,
    )
    db.add(model_run)
    await db.flush()

    # Dispatch Celery task
    from app.tasks.model_tasks import run_mmm_model

    run_mmm_model.delay(model_run.id)
    logger.info(f"Dispatched model run {model_run.id} to Celery")

    return _to_response(model_run)


@router.get("", response_model=list[ModelRunResponse])
async def list_model_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ModelRun)
        .where(ModelRun.workspace_id == current_user.workspace_id)
        .order_by(ModelRun.created_at.desc())
    )
    return [_to_response(r) for r in result.scalars().all()]


@router.get("/{run_id}", response_model=ModelRunResponse)
async def get_model_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    model_run = await _get_run(run_id, current_user.workspace_id, db)
    return _to_response(model_run)


@router.get("/{run_id}/results")
async def get_results(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    model_run = await _get_run(run_id, current_user.workspace_id, db)
    if model_run.status != "completed" or not model_run.results:
        raise HTTPException(status_code=400, detail="Model run not completed yet")
    return model_run.results


@router.get("/{run_id}/summary")
async def get_summary(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    model_run = await _get_run(run_id, current_user.workspace_id, db)
    if model_run.status != "completed" or not model_run.results:
        raise HTTPException(status_code=400, detail="Model run not completed yet")
    return {"summary": model_run.results.get("summary_text", "")}


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    model_run = await _get_run(run_id, current_user.workspace_id, db)

    # Delete model artifact from S3 if exists
    if model_run.model_artifact_s3_key:
        try:
            from app.services.storage import StorageService
            storage = StorageService()
            storage.delete_file(model_run.model_artifact_s3_key)
        except Exception:
            logger.warning(f"Failed to delete S3 artifact for model run {run_id}")

    await db.delete(model_run)


async def _get_run(run_id: str, workspace_id: str, db: AsyncSession) -> ModelRun:
    result = await db.execute(
        select(ModelRun).where(
            ModelRun.id == run_id,
            ModelRun.workspace_id == workspace_id,
        )
    )
    model_run = result.scalar_one_or_none()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found")
    return model_run


def _to_response(r: ModelRun) -> ModelRunResponse:
    return ModelRunResponse(
        id=r.id,
        workspace_id=r.workspace_id,
        dataset_id=r.dataset_id,
        name=r.name,
        status=r.status,
        progress=r.progress,
        config=r.config,
        results=r.results,
        error_message=r.error_message,
        started_at=r.started_at.isoformat() if r.started_at else None,
        completed_at=r.completed_at.isoformat() if r.completed_at else None,
        created_at=r.created_at.isoformat(),
    )
