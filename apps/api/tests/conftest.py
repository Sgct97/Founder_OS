"""Shared test fixtures for the API test suite."""

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, text as sa_text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.database import get_db
from app.main import app
from app.models import Base

# ── Test database engine (NullPool avoids connection reuse conflicts) ──

test_engine = create_async_engine(
    settings.database_url, echo=False, poolclass=NullPool
)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(autouse=True)
async def _setup_db() -> AsyncGenerator[None, None]:
    """Create pgvector extension, all tables before each test, and drop after."""
    async with test_engine.begin() as conn:
        await conn.execute(sa_text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean database session for service-level tests."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency override that returns a test database session."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async HTTP client wired to the FastAPI app with test DB."""
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Helper data factories ────────────────────────────────────────


def make_signup_payload(
    email: str | None = None,
    display_name: str = "Test User",
    workspace_name: str = "Test Workspace",
    supabase_uid: str | None = None,
) -> dict[str, str]:
    """Build a signup request body with optional overrides."""
    return {
        "email": email or f"test-{uuid.uuid4().hex[:8]}@example.com",
        "display_name": display_name,
        "workspace_name": workspace_name,
        "supabase_uid": supabase_uid or f"sb-{uuid.uuid4().hex}",
    }
