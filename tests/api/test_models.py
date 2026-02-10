"""Tests for model run endpoints."""

from httpx import AsyncClient


class TestListModelRuns:
    """GET /api/models"""

    async def test_list_model_runs_authenticated(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.get("/api/models", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_list_model_runs_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/models")
        assert resp.status_code in (401, 403)


class TestGetModelRun:
    """GET /api/models/{run_id}"""

    async def test_get_nonexistent_run(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.get(
            "/api/models/nonexistent-id", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_get_run_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/models/some-id")
        assert resp.status_code in (401, 403)


class TestCreateModelRun:
    """POST /api/models/run"""

    async def test_create_run_unauthenticated(self, client: AsyncClient):
        resp = await client.post(
            "/api/models/run",
            json={"dataset_id": "some-id"},
        )
        assert resp.status_code in (401, 403)

    async def test_create_run_nonexistent_dataset(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.post(
            "/api/models/run",
            json={"dataset_id": "nonexistent-id"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestDeleteModelRun:
    """DELETE /api/models/{run_id}"""

    async def test_delete_nonexistent_run(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.delete(
            "/api/models/nonexistent-id", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_delete_run_unauthenticated(self, client: AsyncClient):
        resp = await client.delete("/api/models/some-id")
        assert resp.status_code in (401, 403)


class TestGetResults:
    """GET /api/models/{run_id}/results"""

    async def test_results_nonexistent_run(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.get(
            "/api/models/nonexistent-id/results", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_results_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/models/some-id/results")
        assert resp.status_code in (401, 403)
