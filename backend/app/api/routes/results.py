import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.model_run import ModelRun
from app.models.user import User
from app.services.progress import ProgressService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["results"])

SSE_KEEPALIVE_SECONDS = 15
SSE_POLL_SECONDS = 0.5


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

    # If already completed or failed, send final status and close
    if model_run.status in ("completed", "failed"):
        async def single_event():
            yield {
                "event": "progress",
                "data": json.dumps({
                    "status": model_run.status,
                    "progress": model_run.progress,
                    "message": f"Model run {model_run.status}",
                    "stage": model_run.status,
                }),
            }
        return EventSourceResponse(single_event())

    async def event_generator():
        progress_service = ProgressService()
        pubsub = progress_service.subscribe(run_id)

        try:
            keepalive_counter = 0
            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                # Poll for Redis messages (non-blocking)
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=SSE_POLL_SECONDS)
                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")

                    yield {
                        "event": "progress",
                        "data": data,
                    }

                    # Check if this is a terminal event
                    try:
                        event = json.loads(data)
                        if event.get("stage") in ("done", "error", "completed", "failed"):
                            break
                    except json.JSONDecodeError:
                        pass
                else:
                    # Send keepalive ping periodically
                    keepalive_counter += 1
                    if keepalive_counter >= int(SSE_KEEPALIVE_SECONDS / SSE_POLL_SECONDS):
                        keepalive_counter = 0
                        yield {"event": "ping", "data": ""}

                await asyncio.sleep(SSE_POLL_SECONDS)
        finally:
            pubsub.unsubscribe()
            pubsub.close()

    return EventSourceResponse(event_generator())
