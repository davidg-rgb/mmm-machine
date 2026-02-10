"""Celery task for running MMM model fits.

This is the integration seam between backend (Celery/DB/S3)
and the data scientist's engine (PyMCMMMEngine).
"""

import json
import logging
from dataclasses import asdict
from datetime import datetime, timezone

import redis

from app.core.config import get_settings
from app.tasks.celery_app import celery_app

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
    r.close()


@celery_app.task(bind=True, max_retries=1, time_limit=3600)
def run_mmm_model(self, model_run_id: str):
    """Celery task: load data, fit model, store results."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.models.dataset import Dataset
    from app.models.model_run import ModelRun
    from app.services.storage import StorageService

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
                model_run.status = "failed"
                model_run.error_message = "Associated dataset not found"
                db.commit()
                return

            if not dataset.column_mapping:
                model_run.status = "failed"
                model_run.error_message = "Dataset has no column mapping"
                db.commit()
                return

            # Update status to preprocessing
            model_run.status = "preprocessing"
            model_run.started_at = datetime.now(timezone.utc)
            model_run.progress = 5
            db.commit()
            _publish_progress(model_run_id, 5, "Loading data...", "preprocessing")

            # Load data from S3
            storage = StorageService()
            df = storage.download_csv(dataset.s3_key)
            _publish_progress(model_run_id, 10, "Data loaded, preparing model...", "preprocessing")

            # Import engine here to avoid heavy imports at module level
            from app.engine.pymc_engine import PyMCMMMEngine

            # Build and fit model
            mmm = PyMCMMMEngine(model_run.config)

            # Prepare data
            model_run.progress = 15
            model_run.status = "preprocessing"
            db.commit()
            _publish_progress(model_run_id, 15, "Preparing data for model...", "preprocessing")

            prepared = mmm.prepare_data(df, dataset.column_mapping)

            # Build model
            model_run.progress = 20
            db.commit()
            _publish_progress(model_run_id, 20, "Building statistical model...", "building")

            mmm.build_model(prepared)

            # Fit model with progress callback
            model_run.status = "fitting"
            model_run.progress = 25
            db.commit()
            _publish_progress(model_run_id, 25, "Starting MCMC sampling...", "fitting")

            def progress_callback(pct: int, msg: str):
                # Scale engine progress (5-90) to our range (25-85)
                scaled = 25 + int((pct / 100) * 60)
                model_run.progress = scaled
                model_run.status = "fitting"
                db.commit()
                _publish_progress(model_run_id, scaled, msg, "fitting")

            mmm.fit(prepared, progress_callback=progress_callback)

            # Extract results
            model_run.progress = 90
            model_run.status = "postprocessing"
            db.commit()
            _publish_progress(model_run_id, 90, "Extracting results...", "postprocessing")

            results = mmm.extract_results()
            results_dict = asdict(results)

            # Upload model artifact to S3
            model_run.progress = 95
            db.commit()
            _publish_progress(model_run_id, 95, "Saving model artifact...", "postprocessing")

            try:
                artifact_bytes = mmm.serialize_model()
                artifact_key = f"artifacts/{model_run.workspace_id}/{model_run_id}/model.pkl"
                storage.upload_file(artifact_key, artifact_bytes, "application/octet-stream")
                model_run.model_artifact_s3_key = artifact_key
            except Exception:
                logger.warning(f"Failed to serialize model artifact for {model_run_id}")

            # Save results
            model_run.results = results_dict
            model_run.status = "completed"
            model_run.progress = 100
            model_run.completed_at = datetime.now(timezone.utc)
            db.commit()

            _publish_progress(model_run_id, 100, "Model complete!", "done")
            logger.info(f"Model run {model_run_id} completed successfully")

    except Exception as exc:
        logger.exception(f"Model run {model_run_id} failed: {exc}")
        try:
            with Session(engine) as db:
                model_run = db.get(ModelRun, model_run_id)
                if model_run:
                    model_run.status = "failed"
                    model_run.error_message = str(exc)[:2000]
                    model_run.completed_at = datetime.now(timezone.utc)
                    db.commit()
        except Exception:
            logger.exception(f"Failed to update error status for model run {model_run_id}")
        _publish_progress(model_run_id, 0, f"Error: {exc}", "error")
        raise
    finally:
        engine.dispose()
