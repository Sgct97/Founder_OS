"""FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FounderOS API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for monitoring and load balancers."""
    return {"status": "healthy", "version": "0.1.0"}


# Router registration.
from app.routers import auth, chat, diary, documents, milestones

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(milestones.router, prefix="/api/v1", tags=["milestones"])
app.include_router(diary.router, prefix="/api/v1/diary", tags=["diary"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])

