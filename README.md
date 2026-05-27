# FounderOS

A cross-platform workspace for startup founders. Upload your docs, ask AI questions grounded in your own files, track milestones, and log daily accountability with your co-founder.

Built for two founders who need shared context without juggling Notion, NotebookLM, and a standup doc in three different places.

## What it does

**Knowledge Base + RAG Chat**
- Upload PDFs, markdown, and plain text
- Ask questions answered only from your uploaded documents
- Every answer includes source citations pointing back to the original chunk

**Milestone Tracker**
- Organize work into phases and milestones
- Track status from not started to in progress to done
- Progress bars show completion at a glance

**Daily Diary**
- Log what you worked on each day
- Tie entries to milestones so both founders see real progress

## Tech stack

| Layer | Technology |
|-------|------------|
| Mobile and web | Expo (React Native), TypeScript |
| API | FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL with pgvector |
| Auth and storage | Supabase Auth, Supabase Storage |
| AI | OpenAI embeddings and chat |

## Architecture

```
Expo App (iOS / Android / Web)
        |
        v
   FastAPI Backend
        |
        +-- Auth, Documents, Milestones, Diary
        |
        v
PostgreSQL + pgvector
```

## Project structure

```
apps/
  api/     FastAPI backend with Alembic migrations
  web/     Expo frontend
docs/
  ARCHITECTURE.md
  PROJECT_BRIEF.md
  HANDOFF.md
```

## Status

Active development. Core models, migrations, and API routes are in place. See `docs/` for full product specs and architecture details.

## Note

Live credentials and deployment configs are not included in this repository.
