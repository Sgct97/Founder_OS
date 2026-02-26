# FounderOS — Agent Handoff (Sprint 4)

## What Is FounderOS?

A cross-platform app (iOS, Android, web) for startup co-founders to:
1. Build a private knowledge base + RAG chat from uploaded documents
2. Track project milestones visually
3. Log daily accountability diary entries

Full spec: `docs/PROJECT_BRIEF.md` | Architecture: `docs/ARCHITECTURE.md` | Rules: `.cursorrules`

---

## What's Done (Sprints 1–3)

### Backend (FastAPI) — `apps/api/`
| Module | Status | Files |
|--------|--------|-------|
| Auth (signup/login/invite/join) | Done | `routers/auth.py`, `services/auth.py`, `models/user.py`, `models/workspace.py` |
| Milestones (CRUD phases + milestones) | Done | `routers/milestones.py`, `services/milestones.py`, `models/phase.py`, `models/milestone.py` |
| Diary (CRUD entries + streaks) | Done | `routers/diary.py`, `services/diary.py`, `models/diary_entry.py` |
| Documents (upload, parse, chunk, embed) | Done | `routers/documents.py`, `services/documents.py`, `models/document.py`, `models/document_chunk.py` |
| Chat (RAG retrieval + SSE streaming) | Done | `routers/chat.py`, `services/chat.py`, `models/conversation.py`, `models/message.py` |
| Tests | Done | `tests/test_auth.py`, `test_milestones.py`, `test_diary.py`, `test_documents.py`, `test_chat.py`, `test_health.py`, `test_database.py`, `test_dependencies.py` |

### Frontend (Expo/React Native) — `apps/mobile/`
| Screen | Status | File |
|--------|--------|------|
| Login/Signup/Invite | Done | `app/(auth)/login.tsx`, `signup.tsx`, `invite.tsx` |
| Knowledge Base (doc list + upload) | Done | `app/(tabs)/knowledge/index.tsx` |
| Document Detail | Done | `app/(tabs)/knowledge/[id].tsx` |
| AI Chat (SSE streaming) | Done | `app/(tabs)/knowledge/chat.tsx` |
| Milestone Board | Done | `app/(tabs)/milestones/index.tsx` |
| Diary Timeline | Done | `app/(tabs)/diary/index.tsx` |
| New Diary Entry | Done | `app/(tabs)/diary/new.tsx` |
| Settings (basic) | Done | `app/(tabs)/settings/index.tsx` |

### Database
- 3 Alembic migrations in `apps/api/alembic/versions/`
- Tables: `users`, `workspaces`, `phases`, `milestones`, `diary_entries`, `documents`, `document_chunks`, `conversations`, `messages`
- pgvector extension enabled for embedding storage

### Deployment
- **API**: Running on DigitalOcean Droplet at `138.197.23.33`
  - Gunicorn + Uvicorn, systemd service (`founderos-api`)
  - PostgreSQL 16 + pgvector on the same droplet
  - Nginx reverse proxy + static file server
- **Web Frontend**: Served from the same droplet at `http://138.197.23.33`
  - Expo web export in `/var/www/founderos-web/`
  - Nginx serves static files, proxies `/api/*` to backend
- **SSH**: `ssh root@138.197.23.33` (deploy user exists but SSH key not set up for it)
- **Redeploy API**: `ssh root@138.197.23.33` then `cd /home/deploy/founder-os && sudo -u deploy bash deploy/redeploy.sh`
- **Redeploy Web**: From local repo root: `bash deploy/redeploy-web.sh`

---

## What's Next: Sprint 4 (Polish)

Per `PROJECT_BRIEF.md` lines 213-217:

### 1. Streak Indicators & Progress Bars
- Diary streak: show consecutive days each founder has logged an entry
- Green check if logged today, red X if not, streak count next to name
- Phase progress bars on the milestone board (X of Y completed)
- The backend endpoint `GET /api/v1/diary/streaks` already exists

### 2. Error States, Empty States, Loading Skeletons
- Every screen needs proper loading skeletons (not just spinners)
- Empty states with helpful CTAs (e.g., "No milestones yet — create your first phase")
- Error states with retry buttons
- The Knowledge Base screens already have good empty states — match that quality

### 3. Testing
- Backend: `pytest` + `httpx`, tests exist for all modules
- Run: `cd apps/api && poetry run pytest -v`
- Maintain ≥90% line coverage
- Frontend: component tests with `@testing-library/react-native` (not yet written)

### 4. Docker Compose for Local Dev
- `docker-compose.yml` exists at repo root with PostgreSQL + pgvector
- Needs verification that full local dev workflow works end-to-end

---

## Key Architecture Details

### Tech Stack
- **Backend**: Python 3.13, FastAPI, SQLAlchemy (async), Alembic, pgvector, OpenAI API
- **Frontend**: TypeScript, Expo SDK 52, React Native, Expo Router, React Query
- **Auth**: Supabase Auth (external) — JWT validation via JWKS endpoint
- **Database**: PostgreSQL 16 + pgvector on the droplet (NOT Supabase's hosted DB)
- **File Parsing**: `pypdf` for PDFs, `beautifulsoup4` for HTML, plain `open()` for everything else

### Design System
- Theme constants: `apps/mobile/constants/theme.ts`
- Dark navy headers (`#0a1628`), teal primary (`#2ec4a0`), white content areas
- ULTRA PREMIUM enterprise-grade UI — match Linear/Stripe/Notion quality
- No emojis in UI. Use Ionicons from `@expo/vector-icons`

### Supported Document Types
PDF, Markdown, Text, CSV, JSON, HTML, YAML, XML, Log, RST

### Environment Variables (Backend)
```
DATABASE_URL=postgresql+asyncpg://founderos:<password>@localhost:5432/founder_os
SUPABASE_URL=https://xwqcnmmdodiireigtjkb.supabase.co
SUPABASE_SERVICE_KEY=<key>
SUPABASE_JWT_SECRET=<key>
OPENAI_API_KEY=<key>
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://138.197.23.33,*
LOG_LEVEL=INFO
UPLOAD_DIR=/home/deploy/founder-os/apps/api/uploads
```

### Environment Variables (Frontend)
```
EXPO_PUBLIC_API_URL=http://138.197.23.33
EXPO_PUBLIC_SUPABASE_URL=https://xwqcnmmdodiireigtjkb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Op5QsFjEFZoEs2YghBdu5Q_77HMFKIa
```

---

## Repo Structure
```
founder-os-repo/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── app/
│   │   │   ├── config.py       # Settings from env vars
│   │   │   ├── database.py     # SQLAlchemy async engine + session
│   │   │   ├── dependencies.py # JWT auth dependency (get_current_user)
│   │   │   ├── main.py         # FastAPI app, CORS, router registration
│   │   │   ├── models/         # SQLAlchemy ORM models
│   │   │   ├── routers/        # API route handlers
│   │   │   ├── schemas/        # Pydantic request/response schemas
│   │   │   └── services/       # Business logic layer
│   │   ├── alembic/            # Database migrations
│   │   ├── tests/              # pytest test suite
│   │   └── pyproject.toml      # Python dependencies (Poetry)
│   └── mobile/                 # Expo/React Native frontend
│       ├── app/                # Expo Router screens
│       │   ├── (auth)/         # Login, signup, invite
│       │   └── (tabs)/         # Main app tabs
│       ├── constants/          # Theme, API config
│       ├── hooks/              # React Query hooks
│       ├── services/           # API client functions
│       ├── types/              # TypeScript interfaces
│       └── package.json
├── deploy/                     # Deployment scripts + configs
│   ├── founderos-api.service   # systemd unit file
│   ├── nginx-founderos.conf    # Nginx config (API + web frontend)
│   ├── redeploy.sh             # API redeploy script (run on droplet)
│   ├── redeploy-web.sh         # Web frontend redeploy (run locally)
│   └── setup-droplet.sh        # Fresh droplet bootstrap
├── docker-compose.yml          # Local dev PostgreSQL + pgvector
└── docs/
    ├── PROJECT_BRIEF.md        # Full product spec
    └── ARCHITECTURE.md         # Technical architecture
```

## GitHub
- Repo: `https://github.com/Sgct97/Founder_OS.git`
- Branch: `main`

## Known Issues / Gotchas
1. The droplet is a 2GB RAM / 1 vCPU instance — avoid installing heavy ML libraries (use lightweight alternatives like `pypdf` instead of `unstructured`)
2. There's a 4GB swap file on the droplet for safety
3. The Render static site (`founder-os-web.onrender.com`) exists but is unused — the web frontend is served from the droplet instead to avoid HTTPS mixed content issues (no domain/SSL yet)
4. No domain or SSL yet — when ready, point a domain A record to `138.197.23.33` and run `sudo certbot --nginx -d yourdomain.com`
5. Frontend `.env` var is `EXPO_PUBLIC_API_URL` (not `EXPO_PUBLIC_API_BASE_URL`)

