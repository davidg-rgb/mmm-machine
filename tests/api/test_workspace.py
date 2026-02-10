"""Tests for workspace endpoints."""

from httpx import AsyncClient


class TestGetWorkspace:
    """GET /api/workspace"""

    async def test_get_workspace_authenticated(
        self, client: AsyncClient, registered_user, auth_headers
    ):
        resp = await client.get("/api/workspace", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == registered_user["workspace_id"]
        assert "name" in data
        assert "created_at" in data

    async def test_get_workspace_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/workspace")
        assert resp.status_code in (401, 403)


class TestUpdateWorkspace:
    """PUT /api/workspace"""

    async def test_update_workspace_unauthenticated(self, client: AsyncClient):
        resp = await client.put(
            "/api/workspace",
            json={"name": "New Name"},
        )
        assert resp.status_code in (401, 403)

    async def test_update_workspace_success(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.put(
            "/api/workspace",
            json={"name": "Updated Workspace"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Workspace"
