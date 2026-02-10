"""Tests for the cache service."""

from unittest.mock import MagicMock, patch

from app.services.cache import get_cached, invalidate, set_cached


class TestCacheService:
    @patch("app.services.cache.get_redis")
    def test_get_cached_returns_none_when_no_redis(self, mock_get_redis):
        mock_get_redis.return_value = None
        assert get_cached("test-key") is None

    @patch("app.services.cache.get_redis")
    def test_get_cached_returns_parsed_json(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_redis.get.return_value = '{"key": "value"}'
        mock_get_redis.return_value = mock_redis
        result = get_cached("test-key")
        assert result == {"key": "value"}

    @patch("app.services.cache.get_redis")
    def test_get_cached_returns_none_on_miss(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        mock_get_redis.return_value = mock_redis
        assert get_cached("missing-key") is None

    @patch("app.services.cache.get_redis")
    def test_set_cached_calls_setex(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        set_cached("test-key", {"data": True}, ttl_seconds=600)
        mock_redis.setex.assert_called_once()
        args = mock_redis.setex.call_args
        assert args[0][0] == "test-key"
        assert args[0][1] == 600

    @patch("app.services.cache.get_redis")
    def test_set_cached_noop_when_no_redis(self, mock_get_redis):
        mock_get_redis.return_value = None
        # Should not raise
        set_cached("test-key", {"data": True})

    @patch("app.services.cache.get_redis")
    def test_invalidate_calls_delete(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        invalidate("test-key")
        mock_redis.delete.assert_called_once_with("test-key")

    @patch("app.services.cache.get_redis")
    def test_invalidate_noop_when_no_redis(self, mock_get_redis):
        mock_get_redis.return_value = None
        # Should not raise
        invalidate("test-key")
