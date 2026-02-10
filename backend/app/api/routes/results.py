from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.model_run import ModelRun

router = APIRouter(prefix="/models", tags=["results"])


@router.get("/{run_id}/progress")
async def stream_progress(
    run_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for real-time model fitting progress."""
    result = await db.execute(
        select(ModelRun).where(
            ModelRun.id == run_id,
            ModelRun.workspace_id == current_user.workspace_id,
        )
    )
    model_run = result.scalar_one_or_none()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found")

    # TODO: Implement Redis pub/sub SSE stream
    # For now return current status as single event
    async def event_generator():
        import json

        yield {
            "event": "progress",
            "data": json.dumps({
                "status": model_run.status,
                "progress": model_run.progress,
                "message": f"Model is {model_run.status}",
                "stage": model_run.status,
            }),
        }

    return EventSourceResponse(event_generator())
