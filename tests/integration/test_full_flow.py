"""End-to-end integration test: register -> workspace -> list datasets.

Tests the full authenticated user flow through the API without external
services. Upload and model run endpoints that depend on S3/Celery are
tested for auth enforcement only.
"""

import pytest
from httpx import AsyncClient


class TestFullUserFlow:
    """E2E: register, login, access workspace, list datasets."""

    async def test_register_then_access_workspace(self, client: AsyncClient):
        # Step 1: Register a new user
        register_resp = await client.post(
            "/api/auth/register",
            json={
                "email": "e2e@example.com",
                "password": "E2EPassword123!",
                "full_name": "E2E User",
                "workspace_name": "E2E Workspace",
            },
        )
        assert register_resp.status_code == 201
        tokens = register_resp.json()
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        # Step 2: Access /me
        me_resp = await client.get("/api/auth/me", headers=headers)
        assert me_resp.status_code == 200
        user = me_resp.json()
        assert user["email"] == "e2e@example.com"
        assert user["full_name"] == "E2E User"
        workspace_id = user["workspace_id"]

        # Step 3: Access workspace
        ws_resp = await client.get("/api/workspace", headers=headers)
        assert ws_resp.status_code == 200
        assert ws_resp.json()["id"] == workspace_id

        # Step 4: List datasets (should be empty)
        ds_resp = await client.get("/api/datasets", headers=headers)
        assert ds_resp.status_code == 200
        assert ds_resp.json() == []

        # Step 5: List model runs (should be empty)
        mr_resp = await client.get("/api/models", headers=headers)
        assert mr_resp.status_code == 200
        assert mr_resp.json() == []

    async def test_login_flow(self, client: AsyncClient, registered_user):
        # Login
        login_resp = await client.post(
            "/api/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        assert login_resp.status_code == 200
        tokens = login_resp.json()

        # Use access token
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        me_resp = await client.get("/api/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == registered_user["email"]

        # Refresh token
        refresh_resp = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert refresh_resp.status_code == 200
        new_tokens = refresh_resp.json()

        # Use new access token
        new_headers = {"Authorization": f"Bearer {new_tokens['access_token']}"}
        me_resp2 = await client.get("/api/auth/me", headers=new_headers)
        assert me_resp2.status_code == 200


class TestWorkspaceIsolation:
    """Verify that users from different workspaces cannot see each other's data."""

    async def test_separate_workspaces(self, client: AsyncClient):
        # Register two users in separate workspaces
        resp1 = await client.post(
            "/api/auth/register",
            json={
                "email": "user_a@iso.com",
                "password": "PassA123!",
                "full_name": "User A",
                "workspace_name": "Workspace A",
            },
        )
        assert resp1.status_code == 201
        headers_a = {"Authorization": f"Bearer {resp1.json()['access_token']}"}

        resp2 = await client.post(
            "/api/auth/register",
            json={
                "email": "user_b@iso.com",
                "password": "PassB123!",
                "full_name": "User B",
                "workspace_name": "Workspace B",
            },
        )
        assert resp2.status_code == 201
        headers_b = {"Authorization": f"Bearer {resp2.json()['access_token']}"}

        # Each user should have their own workspace
        me_a = await client.get("/api/auth/me", headers=headers_a)
        me_b = await client.get("/api/auth/me", headers=headers_b)

        assert me_a.json()["workspace_id"] != me_b.json()["workspace_id"]

        # Both should see empty dataset lists (their own workspace)
        ds_a = await client.get("/api/datasets", headers=headers_a)
        ds_b = await client.get("/api/datasets", headers=headers_b)
        assert ds_a.json() == []
        assert ds_b.json() == []
