"""Shared test fixtures for the MixModel backend test suite.

Uses SQLite in-memory for unit/API tests (no external DB required).
"""

import os
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Override settings BEFORE importing app modules so the in-memory SQLite
# database is used instead of PostgreSQL.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"
os.environ["DATABASE_URL_SYNC"] = "sqlite:///file::memory:?cache=shared&uri=true"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["APP_ENV"] = "test"
os.environ["APP_DEBUG"] = "false"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"

# Clear any cached settings so our env overrides are picked up.
from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.workspace import Workspace  # noqa: E402

# Map PostgreSQL JSONB -> generic JSON for SQLite compatibility in tests.
# This must happen before create_all() so the DDL renders correctly.
for table in Base.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, JSONB):
            column.type = JSON()

# Async SQLite engine for tests
TEST_ENGINE = create_async_engine(
    "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true",
    echo=False,
)
TestSessionLocal = async_sessionmaker(
    TEST_ENGINE, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Create all tables once per test session."""
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session that rolls back after each test."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client that uses the test database session."""

    async def _override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def registered_user(db_session: AsyncSession) -> dict:
    """Create a registered user and return user info + raw password."""
    workspace = Workspace(name="Test Workspace")
    db_session.add(workspace)
    await db_session.flush()

    raw_password = "TestPassword123!"
    user = User(
        email="testuser@example.com",
        hashed_password=hash_password(raw_password),
        full_name="Test User",
        role="admin",
        workspace_id=workspace.id,
    )
    db_session.add(user)
    await db_session.flush()

    return {
        "user": user,
        "workspace": workspace,
        "email": user.email,
        "password": raw_password,
        "user_id": user.id,
        "workspace_id": workspace.id,
    }


@pytest_asyncio.fixture
async def auth_headers(registered_user: dict) -> dict:
    """Return Authorization headers with a valid access token."""
    token = create_access_token(
        registered_user["user_id"],
        {"workspace_id": registered_user["workspace_id"]},
    )
    return {"Authorization": f"Bearer {token}"}
