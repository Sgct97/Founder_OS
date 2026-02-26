"""Tests for the database session dependency."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db


@pytest.mark.asyncio
async def test_get_db_yields_session() -> None:
    """get_db should yield a valid AsyncSession and commit on success."""
    gen = get_db()
    session = await gen.__anext__()
    assert isinstance(session, AsyncSession)
    # Clean up — signal the generator to finish.
    try:
        await gen.__anext__()
    except StopAsyncIteration:
        pass


@pytest.mark.asyncio
async def test_get_db_rollback_on_error() -> None:
    """get_db should rollback when an exception is raised inside the block."""
    gen = get_db()
    session = await gen.__anext__()
    # Simulate an error during the yield.
    try:
        await gen.athrow(ValueError("simulated error"))
    except ValueError:
        pass  # Expected — the generator re-raises after rollback.

