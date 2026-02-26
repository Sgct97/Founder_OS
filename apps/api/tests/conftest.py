"""Shared test fixtures for the API test suite."""

import os
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

# ── Determine test database URL ──────────────────────────────────────
#
# SAFETY: Tests DROP ALL TABLES after every run. They must NEVER point
# at the production database.
#
# Priority:
#   1. TEST_DATABASE_URL env var (explicit override)
#   2. Automatically derive a "_test" variant from DATABASE_URL
#      (uses pydantic settings so .env files are picked up)
#   3. Hard-coded local default
#
# A runtime guard below will refuse to run if the resolved URL does NOT
# contain the word "test" anywhere in the database name.

_prod_url = settings.database_url


def _derive_test_url(prod_url: str) -> str:
    """Swap the database name to append '_test' if not already present."""
    # URL looks like: ...://user:pass@host:port/dbname
    if "/founder_os_test" in prod_url:
        return prod_url  # already points at test DB
    return prod_url.replace("/founder_os", "/founder_os_test")


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _derive_test_url(
    _prod_url
)

# ── Guard: refuse to run against production ──────────────────────────
_db_name = TEST_DATABASE_URL.rsplit("/", 1)[-1].split("?")[0]
if "test" not in _db_name.lower():
    raise RuntimeError(
        f"REFUSING TO RUN TESTS: database name '{_db_name}' does not contain "
        f"'test'. Tests drop all tables — this would destroy production data.\n"
        f"Set TEST_DATABASE_URL to a test database or ensure DATABASE_URL "
        f"points to a database with 'test' in its name."
    )

# ── Test database engine (NullPool avoids connection reuse conflicts) ──

test_engine = create_async_engine(
    TEST_DATABASE_URL, echo=False, poolclass=NullPool
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
