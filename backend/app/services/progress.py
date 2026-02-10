"""Progress tracking service using Redis pub/sub for SSE streaming."""

import json
import logging

import redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ProgressService:
    def __init__(self):
        self.redis = redis.from_url(settings.redis_url)

    def publish(self, run_id: str, progress: int, message: str, stage: str):
        event = {
            "status": stage,
            "progress": progress,
            "message": message,
            "stage": stage,
        }
        self.redis.publish(f"model_progress:{run_id}", json.dumps(event))

    def subscribe(self, run_id: str):
        """Subscribe to progress events for a model run."""
        pubsub = self.redis.pubsub()
        pubsub.subscribe(f"model_progress:{run_id}")
        return pubsub
