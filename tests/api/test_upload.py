"""Tests for dataset upload and management endpoints."""

import pytest
from httpx import AsyncClient


class TestListDatasets:
    """GET /api/datasets"""

    async def test_list_datasets_authenticated(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.get("/api/datasets", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_list_datasets_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/datasets")
        assert resp.status_code == 403


class TestGetDataset:
    """GET /api/datasets/{dataset_id}"""

    async def test_get_nonexistent_dataset(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.get(
            "/api/datasets/nonexistent-id", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_get_dataset_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/datasets/some-id")
        assert resp.status_code == 403


class TestDeleteDataset:
    """DELETE /api/datasets/{dataset_id}"""

    async def test_delete_nonexistent_dataset(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.delete(
            "/api/datasets/nonexistent-id", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_delete_dataset_unauthenticated(self, client: AsyncClient):
        resp = await client.delete("/api/datasets/some-id")
        assert resp.status_code == 403
