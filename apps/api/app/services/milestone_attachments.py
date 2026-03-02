"""Milestone attachment service — upload, list, and delete files for milestones."""

import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.milestone import Milestone
from app.models.milestone_attachment import MilestoneAttachment
from app.models.phase import Phase

logger = logging.getLogger(__name__)

# Max file size: 25 MB
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

# Allowed extensions (generous — these are supporting docs, not executable code)
ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "md", "csv", "json", "html", "htm",
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    "yaml", "yml", "xml", "rst", "log",
}


def _get_extension(filename: str) -> str:
    """Extract lowercase file extension from a filename."""
    return Path(filename).suffix.lstrip(".").lower()


async def _verify_milestone_access(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> Milestone:
    """Verify that a milestone belongs to the user's workspace."""
    result = await db.execute(
        select(Milestone)
        .join(Phase, Milestone.phase_id == Phase.id)
        .where(Milestone.id == milestone_id, Phase.workspace_id == workspace_id)
    )
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )
    return milestone


async def list_attachments(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> list[MilestoneAttachment]:
    """List all attachments for a milestone."""
    await _verify_milestone_access(db, milestone_id, workspace_id)
    result = await db.execute(
        select(MilestoneAttachment)
        .where(MilestoneAttachment.milestone_id == milestone_id)
        .order_by(MilestoneAttachment.created_at.desc())
    )
    return list(result.scalars().all())


async def upload_attachment(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    workspace_id: uuid.UUID,
    file: UploadFile,
) -> MilestoneAttachment:
    """Upload a file attachment to a milestone.

    Saves the file to disk under uploads/milestone_attachments/{milestone_id}/
    and creates a database record.
    """
    await _verify_milestone_access(db, milestone_id, workspace_id)

    filename = file.filename or "untitled"
    ext = _get_extension(filename)

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '.{ext}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read file contents and check size
    contents = await file.read()
    file_size = len(contents)

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large ({file_size / 1024 / 1024:.1f} MB). Maximum is 25 MB.",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty.",
        )

    # Create directory structure
    attachment_id = uuid.uuid4()
    upload_dir = Path(settings.upload_dir) / "milestone_attachments" / str(milestone_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save with unique name to avoid collisions
    safe_filename = f"{attachment_id}_{filename}"
    file_path = upload_dir / safe_filename
    file_path.write_bytes(contents)

    # Create database record
    attachment = MilestoneAttachment(
        id=attachment_id,
        milestone_id=milestone_id,
        filename=filename,
        file_path=str(file_path),
        file_size_bytes=file_size,
        file_type=ext,
    )
    db.add(attachment)
    await db.flush()
    logger.info(
        "Milestone attachment uploaded: id=%s milestone=%s filename=%s",
        attachment.id, milestone_id, filename,
    )
    return attachment


async def delete_attachment(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    attachment_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> None:
    """Delete an attachment from a milestone and remove the file from disk."""
    await _verify_milestone_access(db, milestone_id, workspace_id)

    result = await db.execute(
        select(MilestoneAttachment).where(
            MilestoneAttachment.id == attachment_id,
            MilestoneAttachment.milestone_id == milestone_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    # Remove file from disk
    file_path = Path(attachment.file_path)
    if file_path.exists():
        file_path.unlink()
        logger.info("Deleted file: %s", file_path)

    await db.delete(attachment)
    await db.flush()
    logger.info("Attachment deleted: id=%s", attachment_id)


async def get_attachment(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    attachment_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> MilestoneAttachment:
    """Retrieve an attachment record for download."""
    await _verify_milestone_access(db, milestone_id, workspace_id)

    result = await db.execute(
        select(MilestoneAttachment).where(
            MilestoneAttachment.id == attachment_id,
            MilestoneAttachment.milestone_id == milestone_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )
    return attachment

