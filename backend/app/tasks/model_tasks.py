"""Celery task for running MMM model fits.

This is the integration seam between backend (Celery/DB/S3)
and the data scientist's engine (PyMCMMMEngine).
"""

import json
import logging
from datetime import datetime, timezone

import redis

from app.tasks.celery_app import celery_app
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _publish_progress(run_id: str, progress: int, message: str, stage: str):
    """Publish progress event via Redis pub/sub for SSE streaming."""
    r = redis.from_url(settings.redis_url)
    event = {
        "status": stage,
        "progress": progress,
        "message": message,
        "stage": stage,
    }
    r.publish(f"model_progress:{run_id}", json.dumps(event))


@celery_app.task(bind=True, max_retries=1, time_limit=3600)
def run_mmm_model(self, model_run_id: str):
    """Async task: load data, fit model, store results."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.models.model_run import ModelRun
    from app.models.dataset import Dataset
    from app.engine.pymc_engine import PyMCMMMEngine

    engine = create_engine(settings.database_url_sync)

    try:
        with Session(engine) as db:
            model_run = db.get(ModelRun, model_run_id)
            if not model_run:
                logger.error(f"Model run {model_run_id} not found")
                return

            dataset = db.get(Dataset, model_run.dataset_id)
            if not dataset:
                logger.error(f"Dataset {model_run.dataset_id} not found")
                return

            # Update status
            model_run.status = "preprocessing"
            model_run.started_at = datetime.now(timezone.utc)
            db.commit()
            _publish_progress(model_run_id, 5, "Loading data...", "preprocessing")

            # Load data from S3
            # TODO: Implement S3 download
            # df = storage.download_csv(dataset.s3_key)

            # For now, this is a placeholder
            logger.info(f"Starting model run {model_run_id}")

            # Build and fit model
            mmm = PyMCMMMEngine(model_run.config)

            def progress_callback(pct: int, msg: str):
                model_run.progress = pct
                model_run.status = "fitting"
                db.commit()
                _publish_progress(model_run_id, pct, msg, "fitting")

            # TODO: Wire up actual data loading and fitting
            # prepared = mmm.prepare_data(df, dataset.column_mapping)
            # mmm.build_model(prepared)
            # mmm.fit(prepared, progress_callback=progress_callback)
            # results = mmm.extract_results()

            # model_run.results = asdict(results)  # Convert dataclass to dict
            # model_run.status = "completed"
            # model_run.progress = 100
            # model_run.completed_at = datetime.now(timezone.utc)
            # db.commit()

            _publish_progress(model_run_id, 100, "Model complete!", "done")

    except Exception as exc:
        logger.exception(f"Model run {model_run_id} failed: {exc}")
        with Session(engine) as db:
            model_run = db.get(ModelRun, model_run_id)
            if model_run:
                model_run.status = "failed"
                model_run.error_message = str(exc)
                db.commit()
        _publish_progress(model_run_id, 0, f"Error: {exc}", "error")
        raise
