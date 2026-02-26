# FounderOS — Product Brief

## What Is This?

A cross-platform app (iOS, Android, web) for startup founders to:
1. Build a private knowledge base from uploaded documents and ask an AI questions that are answered ONLY from those documents.
2. Track project milestones visually and mark them complete as they go.
3. Log daily accountability entries tied to milestones so co-founders can see what each person worked on.

## Target Users

Two co-founders building a startup together. They need a shared workspace where they can dump all their technical docs, track progress, and hold each other accountable for daily contributions. Think of it as Notion + NotebookLM + a daily standup log, but purpose-built for early-stage founders.

## User Roles

- **Founder:** Full access to everything. Can upload docs, chat, manage milestones, write diary entries. There are typically 2 founders per workspace.
- **Viewer (future):** Read-only access. Not in MVP.

## Authentication

- Supabase Auth handles signup/login.
- Email + password for MVP. Google OAuth as a stretch goal.
- Each user belongs to one workspace. Workspace is created on first signup, second user joins via invite link.

---

## Feature 1: Knowledge Base + RAG Chat

### Upload Flow
1. User taps "Upload Document" on the Knowledge Base screen.
2. Picks a PDF or markdown file from their device.
3. File uploads to Supabase Storage. A progress indicator shows upload status.
4. Backend processes the file: parse text, chunk it, generate embeddings, store in pgvector.
5. Processing status shown in the UI (queued, processing, ready, failed).
6. Document appears in the Knowledge Base list with title, upload date, page count, and status badge.

### Document List
- Shows all uploaded documents for the workspace.
- Each document shows: title (from filename or first heading), upload date, file size, status (ready/processing/failed).
- Tap a document to see its details: full metadata, number of chunks generated, option to delete.
- Search bar filters documents by title.

### Chat Interface
- Full-screen chat view. Messages alternate between user and AI.
- User types a question. AI responds ONLY from the uploaded documents.
- Each AI response includes source citations: which document and which chunk the answer came from. Tappable to see the full chunk.
- If the AI cannot answer from the available documents, it says: "I don't have enough information in your documents to answer this. Try uploading relevant documentation."
- Chat history is persisted. Users can start new conversations or continue old ones.
- Conversations are listed in a sidebar (web) or separate screen (mobile).

### Document Types Supported (MVP)
- PDF
- Markdown (.md)
- Plain text (.txt)

---

## Feature 2: Milestone Tracker

### Data Model
- **Project:** A workspace has one project (in MVP).
- **Phase:** A project has multiple phases (e.g., "Phase 1: Blueprint", "Phase 2: Foundation"). Ordered.
- **Milestone:** A phase has multiple milestones (e.g., "Set up Auth0", "Design SQL schema"). Ordered within a phase. Has a status: not_started, in_progress, completed.

### Milestone Board Screen
- Shows all phases as expandable sections.
- Each phase shows a progress bar (X of Y milestones completed).
- Each milestone shows: title, status indicator (circle: empty, half, checked), optional description.
- Tap a milestone to toggle its status: not_started -> in_progress -> completed.
- Long press (or swipe on mobile) to edit title/description.

### Phase Management
- Founders can add new phases and milestones.
- Drag to reorder phases and milestones within a phase.
- Delete a phase (confirmation required, cascades to milestones).

### Import Feature (stretch goal)
- Paste a markdown list and auto-generate phases/milestones from it. This would let founders paste in their existing scope docs.

---

## Feature 3: Accountability Diary

### Daily Log Entry
- User taps "Log Entry" (floating action button or tab).
- Form fields:
  - Date (defaults to today, can backfill).
  - Linked milestone (dropdown of all milestones, optional).
  - Hours worked (number input, optional).
  - Description (free text, what did you do?).
- Submit saves to database. Entry appears in the timeline.

### Timeline View
- Reverse chronological feed of all diary entries from both founders.
- Each entry shows: author avatar/initials, date, linked milestone (if any), hours, description.
- Color-coded by author so you can quickly see who logged what.
- Filter by: author, milestone, date range.

### Streak Indicator
- Shows consecutive days each founder has logged an entry.
- If the commitment is "2 hours/day," show a visual of whether each founder hit that target today.
- Simple: green check if logged today, red X if not. Streak count next to each founder's name.

### Weekly Summary (stretch goal)
- Auto-generated summary: total hours per founder, milestones completed, entries logged. Sent via push notification or email on Sunday night.

---

## Screens (Expo Router Structure)

```
app/
  (auth)/
    login.tsx              # Email + password login
    signup.tsx             # Create account
    invite.tsx             # Join workspace via invite link
  (tabs)/
    knowledge/
      index.tsx            # Document list + upload button
      [id].tsx             # Document detail
      chat/
        index.tsx          # Conversation list
        [id].tsx           # Chat conversation
    milestones/
      index.tsx            # Milestone board (all phases)
    diary/
      index.tsx            # Timeline feed
      new.tsx              # New log entry form
    settings/
      index.tsx            # Profile, workspace, invite link
```

## Navigation
- Bottom tab bar with 4 tabs: Knowledge, Milestones, Diary, Settings.
- Knowledge tab has a nested stack for document detail and chat.
- Auth screens are outside the tab navigator (shown when not logged in).

---

## API Endpoints (FastAPI)

### Auth
- `POST /api/v1/auth/signup` — Create account + workspace
- `POST /api/v1/auth/login` — Get JWT token
- `POST /api/v1/auth/invite` — Generate invite link
- `POST /api/v1/auth/join` — Join workspace via invite code

### Documents
- `GET /api/v1/documents` — List all documents in workspace
- `POST /api/v1/documents` — Upload a document (multipart form)
- `GET /api/v1/documents/{id}` — Document detail
- `DELETE /api/v1/documents/{id}` — Delete document + chunks
- `GET /api/v1/documents/{id}/status` — Processing status

### Chat
- `GET /api/v1/conversations` — List conversations
- `POST /api/v1/conversations` — Create new conversation
- `GET /api/v1/conversations/{id}/messages` — Get messages
- `POST /api/v1/conversations/{id}/messages` — Send message (returns streamed AI response)
- `DELETE /api/v1/conversations/{id}` — Delete conversation

### Milestones
- `GET /api/v1/phases` — List all phases with milestones
- `POST /api/v1/phases` — Create phase
- `PATCH /api/v1/phases/{id}` — Update phase (title, order)
- `DELETE /api/v1/phases/{id}` — Delete phase
- `POST /api/v1/phases/{id}/milestones` — Create milestone
- `PATCH /api/v1/milestones/{id}` — Update milestone (title, status, order)
- `DELETE /api/v1/milestones/{id}` — Delete milestone

### Diary
- `GET /api/v1/diary` — List entries (supports ?author=, ?milestone=, ?from=, ?to=)
- `POST /api/v1/diary` — Create entry
- `PATCH /api/v1/diary/{id}` — Edit entry
- `DELETE /api/v1/diary/{id}` — Delete entry
- `GET /api/v1/diary/streaks` — Get streak data for all workspace members

---

## Design Guidelines

- Clean, minimal, professional. Think Linear or Notion, not Jira.
- Dark navy (`#0a1628`) for headers and navigation.
- Teal/green (`#2ec4a0`) for primary actions and success states.
- White/light gray backgrounds for content areas.
- System fonts (no custom fonts in MVP).
- Consistent 8px spacing grid.
- Cards with subtle shadows for content grouping.
- No emojis in the UI. Use simple icons (Expo vector icons).

---

## Build Order (suggested sequence for the agent)

### Sprint 1: Foundation
1. Backend: FastAPI project setup, config, health endpoint, Docker Compose with PostgreSQL + pgvector.
2. Database: Alembic setup, initial migration with users, workspaces tables.
3. Frontend: Expo project init with TypeScript, Expo Router, tab navigation scaffold, theme constants.
4. Auth: Supabase Auth integration (backend validates JWT, frontend login/signup screens).

### Sprint 2: Milestones + Diary
5. Database: phases, milestones, diary_entries tables + migrations.
6. Backend: milestone CRUD endpoints + diary CRUD endpoints.
7. Frontend: milestone board screen, diary timeline screen, new entry form.
8. Real-time: milestones and diary entries sync across both founders (Supabase Realtime or polling).

### Sprint 3: Knowledge Base + RAG
9. Database: documents, document_chunks tables + migrations (pgvector).
10. Backend: document upload endpoint, PDF processing pipeline, embedding generation.
11. Backend: chat endpoint with RAG retrieval + streaming.
12. Frontend: document list, upload flow, chat interface with streaming responses.

### Sprint 4: Polish
13. Streak indicators, progress bars, filtering.
14. Error states, empty states, loading skeletons.
15. Testing: backend pytest suite, frontend component tests.
16. Docker Compose for full local development workflow.

