"""Tests for the health-check endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient) -> None:
    """GET /api/health should return 200 with status and version."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


@pytest.mark.asyncio
async def test_health_response_schema(client: AsyncClient) -> None:
    """Health response body must contain exactly {status, version}."""
    response = await client.get("/api/health")
    data = response.json()
    assert set(data.keys()) == {"status", "version"}
    assert isinstance(data["status"], str)
    assert isinstance(data["version"], str)


@pytest.mark.asyncio
async def test_health_version_matches_app(client: AsyncClient) -> None:
    """Reported version must match the app's configured version."""
    response = await client.get("/api/health")
    assert response.json()["version"] == "0.1.0"

