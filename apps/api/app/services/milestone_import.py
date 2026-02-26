"""Milestone import service — uses GPT-5.2 to parse text into phases and milestones."""

import json
import logging
import uuid

from fastapi import HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.milestone import Milestone
from app.models.phase import Phase
from app.schemas.milestones import (
    ImportMilestoneItem,
    ImportPhaseItem,
    MilestoneImportPreview,
)

logger = logging.getLogger(__name__)

AI_MODEL = "gpt-5.2"

IMPORT_SYSTEM_PROMPT = """\
You are a project planning assistant. The user will provide raw text \
(markdown, plain text, bullet points, numbered lists, or even prose) \
that describes a project plan, roadmap, or scope document.

Your job is to extract a structured list of **phases** and **milestones** \
from the text. Follow these rules:

1. Each phase represents a major stage or category of work.
2. Each milestone is a concrete, actionable task within a phase.
3. If the text has clear headings/sections, use those as phase titles.
4. If the text is a flat list, group related items into logical phases.
5. Preserve the original ordering.
6. Keep titles concise but descriptive (max 80 chars).
7. Add a brief description to milestones ONLY if the source text provides \
   additional detail beyond the title.
8. If a phase has a description in the source, include it.
9. Aim for 2-8 milestones per phase. Split large phases if needed.
10. Do NOT invent milestones that aren't in the source text.

Respond with ONLY valid JSON matching this exact schema:
{
  "phases": [
    {
      "title": "Phase title",
      "description": "Optional phase description or null",
      "milestones": [
        {
          "title": "Milestone title",
          "description": "Optional description or null"
        }
      ]
    }
  ]
}

No markdown fences, no commentary — just the JSON object."""


async def parse_text_with_ai(content: str) -> MilestoneImportPreview:
    """Send raw text to GPT-5.2 and get back structured phases/milestones.

    Args:
        content: Raw markdown or plain text to parse.

    Returns:
        MilestoneImportPreview with extracted phases and milestones.

    Raises:
        HTTPException 502: If the AI call fails or returns invalid JSON.
        HTTPException 422: If no phases could be extracted.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenAI API key not configured. Cannot parse milestones.",
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    try:
        response = await client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": IMPORT_SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            temperature=0.1,  # Low temperature for structured extraction
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI returned an empty response.",
            )

        data = json.loads(raw)
        phases_raw = data.get("phases", [])

        if not phases_raw:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract any phases from the provided text. "
                "Try providing more structured content with clear headings or bullet points.",
            )

        # Validate through Pydantic models
        phases = []
        total_milestones = 0
        for p in phases_raw:
            milestones = [
                ImportMilestoneItem(
                    title=m.get("title", "Untitled"),
                    description=m.get("description"),
                )
                for m in p.get("milestones", [])
            ]
            total_milestones += len(milestones)
            phases.append(
                ImportPhaseItem(
                    title=p.get("title", "Untitled Phase"),
                    description=p.get("description"),
                    milestones=milestones,
                )
            )

        return MilestoneImportPreview(
            phases=phases,
            total_phases=len(phases),
            total_milestones=total_milestones,
        )

    except json.JSONDecodeError as exc:
        logger.exception("AI returned invalid JSON: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned invalid JSON. Please try again.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("AI milestone parsing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI parsing failed: {exc}",
        ) from exc


async def create_phases_from_preview(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    preview: MilestoneImportPreview,
    replace_existing: bool = False,
) -> list[Phase]:
    """Create phases and milestones in the database from a parsed preview.

    Args:
        db: Active database session.
        workspace_id: The workspace to create phases in.
        preview: The parsed preview with phases and milestones.
        replace_existing: If True, delete all existing phases first.

    Returns:
        List of newly created Phase objects with milestones loaded.
    """
    if replace_existing:
        # Delete all existing phases (milestones cascade)
        existing = await db.execute(
            select(Phase).where(Phase.workspace_id == workspace_id)
        )
        for phase in existing.scalars().all():
            await db.delete(phase)
        await db.flush()
        logger.info(
            "Deleted existing phases for workspace=%s (replace mode)",
            workspace_id,
        )
        starting_order = 0
    else:
        # Find the highest existing sort_order to append after
        existing = await db.execute(
            select(Phase.sort_order)
            .where(Phase.workspace_id == workspace_id)
            .order_by(Phase.sort_order.desc())
            .limit(1)
        )
        max_order = existing.scalar_one_or_none()
        starting_order = (max_order or 0) + 1

    created_phase_ids = []

    for i, phase_data in enumerate(preview.phases):
        phase = Phase(
            workspace_id=workspace_id,
            title=phase_data.title,
            description=phase_data.description,
            sort_order=starting_order + i,
        )
        db.add(phase)
        await db.flush()  # Get the phase ID

        for j, ms_data in enumerate(phase_data.milestones):
            milestone = Milestone(
                phase_id=phase.id,
                title=ms_data.title,
                description=ms_data.description,
                status="not_started",
                sort_order=j,
            )
            db.add(milestone)

        created_phase_ids.append(phase.id)
        logger.info(
            "Phase created via import: id=%s title=%s milestones=%d",
            phase.id,
            phase_data.title,
            len(phase_data.milestones),
        )

    await db.flush()

    # Re-fetch with milestones loaded
    result = await db.execute(
        select(Phase)
        .where(Phase.id.in_(created_phase_ids))
        .options(selectinload(Phase.milestones))
        .order_by(Phase.sort_order)
    )
    return list(result.scalars().all())

