import json
import logging
from typing import Any

import redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    """Get a Redis client, returning None if unavailable."""
    global _redis_client
    if _redis_client is None:
        try:
            settings = get_settings()
            _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            _redis_client.ping()
        except Exception:
            logger.warning("Redis not available for caching")
            _redis_client = None
    return _redis_client


def get_cached(key: str) -> Any | None:
    """Get a cached value by key."""
    r = get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        logger.warning(f"Cache read failed for key={key}")
    return None


def set_cached(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    """Set a cached value with TTL."""
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        logger.warning(f"Cache write failed for key={key}")


def invalidate(key: str) -> None:
    """Delete a cached key."""
    r = get_redis()
    if r is None:
        return
    try:
        r.delete(key)
    except Exception:
        pass
