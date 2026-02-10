"""Tests for authentication endpoints: register, login, refresh, me."""

from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


class TestRegister:
    """POST /api/auth/register"""

    async def test_register_success(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "new@example.com",
                "password": "StrongPass123!",
                "full_name": "New User",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_register_duplicate_email(self, client: AsyncClient, registered_user):
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": registered_user["email"],
                "password": "AnotherPass123!",
                "full_name": "Duplicate User",
            },
        )
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    async def test_register_missing_email(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "password": "StrongPass123!",
                "full_name": "No Email",
            },
        )
        assert resp.status_code == 422

    async def test_register_missing_password(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "nopass@example.com",
                "full_name": "No Pass",
            },
        )
        assert resp.status_code == 422

    async def test_register_missing_full_name(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "noname@example.com",
                "password": "StrongPass123!",
            },
        )
        assert resp.status_code == 422

    async def test_register_invalid_email(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "StrongPass123!",
                "full_name": "Bad Email",
            },
        )
        assert resp.status_code == 422

    async def test_register_with_workspace_name(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "workspace@example.com",
                "password": "StrongPass123!",
                "full_name": "Workspace User",
                "workspace_name": "My Company",
            },
        )
        assert resp.status_code == 201
        assert "access_token" in resp.json()


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class TestLogin:
    """POST /api/auth/login"""

    async def test_login_success(self, client: AsyncClient, registered_user):
        resp = await client.post(
            "/api/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, registered_user):
        resp = await client.post(
            "/api/auth/login",
            json={
                "email": registered_user["email"],
                "password": "WrongPassword123!",
            },
        )
        assert resp.status_code == 401
        assert "invalid credentials" in resp.json()["detail"].lower()

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "SomePass123!",
            },
        )
        assert resp.status_code == 401

    async def test_login_missing_fields(self, client: AsyncClient):
        resp = await client.post("/api/auth/login", json={"email": "test@example.com"})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


class TestRefresh:
    """POST /api/auth/refresh"""

    async def test_refresh_success(self, client: AsyncClient, registered_user):
        # First login to get a refresh token
        login_resp = await client.post(
            "/api/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        refresh_token = login_resp.json()["refresh_token"]

        resp = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert resp.status_code == 401

    async def test_refresh_with_access_token_rejected(
        self, client: AsyncClient, registered_user
    ):
        """Using an access token as a refresh token should fail."""
        login_resp = await client.post(
            "/api/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        access_token = login_resp.json()["access_token"]

        resp = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": access_token},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------


class TestMe:
    """GET /api/auth/me"""

    async def test_me_authenticated(
        self, client: AsyncClient, registered_user, auth_headers
    ):
        resp = await client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == registered_user["email"]
        assert data["full_name"] == "Test User"
        assert data["role"] == "admin"
        assert data["workspace_id"] == registered_user["workspace_id"]

    async def test_me_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    async def test_me_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        assert resp.status_code == 401
