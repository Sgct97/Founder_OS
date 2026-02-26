# FounderOS — Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                   Expo App (TypeScript)              │
│            iOS  /  Android  /  Web                   │
│                                                      │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│   │Knowledge │  │Milestones│  │  Diary   │         │
│   │  Base    │  │  Board   │  │ Timeline │         │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│        │              │              │               │
│        └──────────────┼──────────────┘               │
│                       │                              │
│              services/api.ts                         │
│           (shared HTTP client)                       │
└───────────────────────┬──────────────────────────────┘
                        │  HTTPS / JWT
                        ▼
┌───────────────────────────────────────────────────────┐
│                  FastAPI Backend                       │
│                  /api/v1/*                             │
│                                                       │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │
│   │ Auth   │  │  Docs  │  │Mileston│  │ Diary  │    │
│   │ Router │  │ Router │  │ Router │  │ Router │    │
│   └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘    │
│       │            │           │            │         │
│   ┌───┴────┐  ┌───┴────┐  ┌──┴─────┐  ┌──┴─────┐   │
│   │  Auth  │  │  Doc   │  │Mileston│  │ Diary  │   │
│   │Service │  │Service │  │Service │  │Service │   │
│   └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘   │
│       │            │           │            │         │
│       └────────────┼───────────┼────────────┘         │
│                    │           │                       │
│            ┌───────┴──┐  ┌────┴────┐                  │
│            │  OpenAI  │  │Supabase │                  │
│            │   API    │  │ Storage │                  │
│            └──────────┘  └─────────┘                  │
└────────────────────┬──────────────────────────────────┘
                     │  SQLAlchemy async
                     ▼
┌───────────────────────────────────────────────────────┐
│              PostgreSQL + pgvector                     │
│                                                       │
│   users, workspaces, documents, document_chunks,      │
│   phases, milestones, diary_entries, conversations,   │
│   messages                                            │
└───────────────────────────────────────────────────────┘
```

## Database Schema

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| email | varchar(255) | unique, not null |
| display_name | varchar(100) | not null |
| avatar_url | text | nullable |
| workspace_id | uuid | FK -> workspaces.id |
| supabase_uid | varchar(255) | Supabase Auth user ID |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now(), auto-update |

### workspaces
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar(100) | not null |
| invite_code | varchar(20) | unique, for joining |
| commitment_hours | numeric(3,1) | daily hour target (e.g., 2.0) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### documents
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK -> workspaces.id |
| uploaded_by | uuid | FK -> users.id |
| title | varchar(255) | extracted from filename or content |
| file_path | text | path in Supabase Storage |
| file_size_bytes | integer | |
| file_type | varchar(10) | pdf, md, txt |
| chunk_count | integer | populated after processing |
| status | varchar(20) | queued, processing, ready, failed |
| error_message | text | nullable, populated on failure |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### document_chunks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| document_id | uuid | FK -> documents.id, cascade delete |
| chunk_index | integer | order within document |
| content | text | the actual text chunk |
| token_count | integer | for context window budgeting |
| embedding | vector(1536) | pgvector, text-embedding-3-small |
| metadata | jsonb | page number, section heading, etc. |
| created_at | timestamptz | |

Index: `CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`

### conversations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK -> workspaces.id |
| created_by | uuid | FK -> users.id |
| title | varchar(255) | auto-generated from first message |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### messages
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| conversation_id | uuid | FK -> conversations.id, cascade delete |
| role | varchar(10) | user or assistant |
| content | text | message text |
| sources | jsonb | array of {document_id, chunk_id, snippet} |
| created_at | timestamptz | |

### phases
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK -> workspaces.id |
| title | varchar(255) | not null |
| description | text | nullable |
| sort_order | integer | for ordering |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### milestones
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| phase_id | uuid | FK -> phases.id, cascade delete |
| title | varchar(255) | not null |
| description | text | nullable |
| status | varchar(20) | not_started, in_progress, completed |
| sort_order | integer | for ordering within phase |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### diary_entries
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK -> workspaces.id |
| author_id | uuid | FK -> users.id |
| milestone_id | uuid | FK -> milestones.id, nullable |
| entry_date | date | the date the work was done |
| hours_worked | numeric(4,2) | nullable |
| description | text | not null |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## RAG Pipeline Detail

### Ingestion (on document upload)

```
1. Frontend uploads file to Supabase Storage via presigned URL
2. Frontend calls POST /api/v1/documents with file metadata
3. Backend creates document record with status="queued"
4. Background task picks up the job:
   a. Download file from Supabase Storage
   b. Parse with `unstructured`:
      - PDF: partition_pdf() extracts text by page/section
      - Markdown: partition_md()
      - Text: partition_text()
   c. Chunk the parsed elements:
      - Target: 512 tokens per chunk
      - Overlap: 50 tokens between chunks
      - Respect paragraph/section boundaries when possible
   d. For each chunk:
      - Call OpenAI text-embedding-3-small to get 1536-dim vector
      - Store chunk text + embedding + metadata in document_chunks
   e. Update document status to "ready" (or "failed" with error_message)
```

### Retrieval (on chat message)

```
1. User sends message via POST /api/v1/conversations/{id}/messages
2. Backend generates embedding for the user's question
3. Cosine similarity search in pgvector:
   SELECT id, content, metadata, document_id,
          1 - (embedding <=> $query_embedding) as similarity
   FROM document_chunks
   WHERE document_id IN (SELECT id FROM documents WHERE workspace_id = $ws_id AND status = 'ready')
   ORDER BY embedding <=> $query_embedding
   LIMIT 5;
4. Build prompt:
   System: "You are a helpful assistant. Answer the user's question using ONLY
   the context provided below. If the context doesn't contain enough information,
   say so. Cite which document each piece of information comes from."

   Context:
   [Document: {title}] {chunk_content}
   [Document: {title}] {chunk_content}
   ...

   User: {question}

5. Call OpenAI gpt-4o with streaming enabled
6. Stream response back to frontend via Server-Sent Events (SSE)
7. After streaming completes, save the full response + source citations to messages table
```

### Background Task Processing

For MVP, use FastAPI's `BackgroundTasks` for document processing. This runs in-process, which is fine for 2 users. If processing becomes slow or we need reliability, upgrade to a task queue (Celery + Redis or ARQ) in a future phase.

---

## Authentication Flow

```
1. User opens app → check for stored JWT in SecureStore (mobile) or localStorage (web)
2. No token → show login screen
3. User signs up/logs in via Supabase Auth SDK (called from frontend)
4. Supabase returns JWT + refresh token
5. Frontend stores tokens securely
6. All API calls include Authorization: Bearer {jwt} header
7. Backend middleware validates JWT against Supabase's JWKS endpoint
8. Backend extracts user ID from JWT claims, loads user from database
9. User object injected into route handlers via FastAPI dependency
```

---

## Environment Variables

### Backend (.env) — on the Droplet
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/founder_os
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=sk-...
CORS_ORIGINS=https://founder-os.expo.dev,exp://your-ip:8081
LOG_LEVEL=INFO
DOMAIN=api.founderos.app
```

### Frontend (.env)
```
EXPO_PUBLIC_API_URL=https://api.founderos.app
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Production Deployment

This is a production app from day one. The backend runs on a DigitalOcean Droplet. The frontend is built and distributed via Expo's EAS (Expo Application Services). Both founders install the app on their phones and see each other's changes in real time.

### Backend — DigitalOcean Droplet

**Droplet spec:** Ubuntu 24.04, 2 GB RAM / 1 vCPU ($12/month) is sufficient for 2 users + the RAG pipeline. Upgrade to 4 GB if PDF processing feels slow.

**What runs on the Droplet:**
- PostgreSQL 16 + pgvector (installed directly or via Docker)
- FastAPI backend (run via Gunicorn + Uvicorn workers)
- Nginx as a reverse proxy (handles HTTPS via Let's Encrypt)
- Certbot for automatic SSL certificate renewal

**Droplet architecture:**
```
Internet
   │
   ▼
┌──────────────────────────────────────────┐
│  DigitalOcean Droplet (Ubuntu 24.04)     │
│                                          │
│  ┌─────────┐     ┌──────────────────┐    │
│  │  Nginx  │────▶│  Gunicorn        │    │
│  │  :443   │     │  + Uvicorn       │    │
│  │  HTTPS  │     │  FastAPI :8000   │    │
│  └─────────┘     └────────┬─────────┘    │
│                           │              │
│                  ┌────────▼─────────┐    │
│                  │  PostgreSQL 16   │    │
│                  │  + pgvector      │    │
│                  │  :5432           │    │
│                  └──────────────────┘    │
└──────────────────────────────────────────┘
```

**Domain and SSL:**
- Point a domain (e.g., `api.founderos.app`) to the Droplet's IP via an A record.
- Nginx terminates SSL. Certbot auto-renews the Let's Encrypt certificate.
- All API traffic is HTTPS. The frontend never talks to a bare IP.

**Deployment flow (CI/CD via GitHub Actions):**
```
1. Push to `main` branch on GitHub
2. GitHub Actions runs:
   a. ruff lint + mypy type check
   b. pytest test suite
   c. If tests pass: SSH into Droplet
   d. git pull latest code
   e. poetry install (if deps changed)
   f. alembic upgrade head (if migrations changed)
   g. systemctl restart founderos-api
3. Total deploy time: ~60 seconds
```

**Systemd service file** (`/etc/systemd/system/founderos-api.service`):
```ini
[Unit]
Description=FounderOS FastAPI Backend
After=network.target postgresql.service

[Service]
User=deploy
WorkingDirectory=/home/deploy/founder-os/apps/api
Environment="PATH=/home/deploy/.local/bin:/usr/bin"
EnvironmentFile=/home/deploy/founder-os/apps/api/.env
ExecStart=/home/deploy/.local/bin/poetry run gunicorn app.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --access-logfile - \
    --error-logfile -
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Nginx config** (`/etc/nginx/sites-available/founderos`):
```nginx
server {
    listen 443 ssl http2;
    server_name api.founderos.app;

    ssl_certificate /etc/letsencrypt/live/api.founderos.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.founderos.app/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support (for streaming chat responses)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name api.founderos.app;
    return 301 https://$host$request_uri;
}
```

### Frontend — Expo EAS

**Development builds:** Use `eas build` to create installable dev builds that both founders load on their phones. These point to the production Droplet API, not localhost.

**Distribution:**
- During development: EAS Development Builds. Both founders install via QR code or direct link.
- For beta/testing: EAS Update (over-the-air updates, no App Store needed). Push a JS update and both phones get it in seconds.
- For production release: EAS Submit to App Store and Google Play.

**Build and update flow:**
```
# First time: create a development build both founders install
eas build --profile development --platform all

# After code changes: push an OTA update (no rebuild needed for JS changes)
eas update --branch main --message "Added milestone filtering"

# Both founders' apps auto-update within minutes
```

**EAS config** (`apps/mobile/eas.json`):
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Real-Time Sync Between Devices

When Kyle marks a milestone complete on his phone, Spenser sees it update on his phone immediately. This is handled by **TanStack Query (React Query) + short polling** in MVP:

- All data-fetching hooks use React Query with a `refetchInterval` of 5 seconds for active screens (milestones board, diary timeline).
- When a user makes a mutation (mark milestone, add diary entry), React Query invalidates the cache and refetches immediately.
- Net effect: changes appear on the other device within 5 seconds. No WebSocket complexity.

**Upgrade path (if needed):** Supabase Realtime (PostgreSQL LISTEN/NOTIFY) for true instant sync. But 5-second polling is invisible to humans for a 2-person app.

### Supabase (Managed Services)

Supabase handles three things so we don't have to:
- **Auth:** User signup/login, JWT issuance, password reset. Hosted by Supabase, not on our Droplet.
- **Storage:** PDF/document file storage with presigned upload URLs. Files stored in Supabase's S3 bucket.
- **Dashboard:** Free admin panel to inspect users, storage, and auth logs.

The actual PostgreSQL database runs on the Droplet (not Supabase's hosted DB) to keep costs low and latency minimal. Supabase Auth and Storage are separate managed services that talk to our backend via their SDK.

### Cost Breakdown (Monthly)
| Service | Cost |
|---------|------|
| DigitalOcean Droplet (2 GB) | $12 |
| Domain name | ~$1 (amortized) |
| Supabase (free tier) | $0 |
| OpenAI API (light RAG usage) | ~$2-5 |
| Expo EAS (free tier: 30 builds/month) | $0 |
| **Total** | **~$15-18/month** |

---

## Local Development Setup

For local development, the same code runs on your machine. The only difference is the API URL points to localhost instead of the Droplet.

```bash
# 1. Start local database
docker compose up -d

# 2. Backend
cd apps/api
cp .env.example .env  # edit with local values
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd apps/mobile
# Set EXPO_PUBLIC_API_URL=http://localhost:8000 in .env
npx expo install
npx expo start
```

Both founders can develop locally and test against their own database, then push to GitHub and the CI/CD pipeline deploys to the shared Droplet automatically.

---

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Monorepo vs separate repos | Monorepo | Two founders, one project. Simpler to manage. |
| Hosting | DigitalOcean Droplet | $12/month, full control, SSH access, simple. No vendor abstraction. |
| Frontend distribution | Expo EAS | OTA updates without App Store review. Both founders get changes in minutes. |
| Real-time sync | React Query polling (5s) | No WebSocket complexity. Invisible latency for 2 users. |
| ORM | SQLAlchemy 2.0 async | Industry standard, explicit, great migration tooling via Alembic. |
| Embedding model | text-embedding-3-small | Best cost/quality ratio. 1536 dimensions. $0.02/1M tokens. |
| Chat model | gpt-4o | Best quality for RAG. Can switch to gpt-4o-mini if cost is a concern. |
| Vector search | pgvector (IVFFlat) | No separate vector DB needed. PostgreSQL handles everything. |
| PDF parsing | unstructured | Best open-source PDF parser. Handles tables, images, headers. |
| State management | React Context + React Query | Simple. No boilerplate. React Query handles caching and sync. |
| Styling | StyleSheet.create | Native, performant, no build-time dependencies. |
| Auth | Supabase Auth | Free tier handles 50K MAU. JWT-based, works with our FastAPI middleware. |
| File storage | Supabase Storage | Same project as auth. Presigned URLs for direct upload. |
| Background tasks | FastAPI BackgroundTasks | Good enough for 2 users. No infra overhead. |
| Streaming | Server-Sent Events | Simpler than WebSockets for one-way streaming. Native fetch support. |
| CI/CD | GitHub Actions + SSH deploy | Simple, free for public repos, no container registry needed. |
| SSL | Let's Encrypt + Certbot | Free, auto-renewing HTTPS. Industry standard. |




THE FRONT END MUST LOOK ULTRA PREMIUM AND ENTERPRISE GRADE. SOMETHING THAT YOU WOULD EXPECT FROM THE TOP TECH FIRSM IN THE WORLD 