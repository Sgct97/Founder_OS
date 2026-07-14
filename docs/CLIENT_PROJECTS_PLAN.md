# Plan: Client Projects + Light/Dark Theme

Feature branch: `feature/client-projects-and-theme`  
Synced from `main` @ `809e653`. Unrelated local WIP stashed as `wip-before-client-projects`.

## Product decisions (locked)

- One **workspace per client**; jobs = **Projects** inside that workspace
- Same permissions for everyone (no client vs dev UI)
- Isolation = `workspace_id` on every query (no cross-workspace leaks)
- Project home = **Preview** (embed Render/deployed URL)
- GitHub URL + docs feed project RAG chat
- Feedback is separate; does **not** auto-create milestones
- Keep existing Founder OS (Knowledge, Milestones, Diary, Features, Chat)

---

## Checklist

### 0. Repo / process
- [x] Pull latest `main`
- [x] Create + push `feature/client-projects-and-theme`
- [ ] Keep PR focused; restore stash later if needed

### 1. Light / dark mode
- [ ] Theme tokens: `dark` (current) + `light` palettes
- [ ] `ThemeProvider` + persist preference (SecureStore / localStorage)
- [ ] Settings toggle (Light / Dark / System optional)
- [ ] Wire `StatusBar` + root backgrounds to theme
- [ ] Migrate shared UI (`Button`, `Input`, layouts) to `useTheme()`
- [ ] Migrate remaining screens to theme-aware styles
- [ ] Verify toggle on web + native

### 2. Backend — Projects
- [ ] `projects` table: id, workspace_id, name, brief, github_url, preview_url, created_by, timestamps
- [ ] Alembic migration
- [ ] Pydantic schemas + CRUD router (`/api/v1/projects`)
- [ ] Always filter by current user's `workspace_id`
- [ ] Unit/integration tests (≥90% on new modules)

### 3. Backend — Project docs / chat / feedback
- [ ] Optional `project_id` on documents (null = workspace knowledge base)
- [ ] Project-scoped conversations (or `project_id` on conversations)
- [ ] `project_feedback` table: project_id, author_id, body, status (open/addressing/done), optional anchor metadata
- [ ] Feedback CRUD API + isolation tests
- [ ] RAG retrieval filtered by workspace + project when chatting in a project

### 4. Frontend — Projects
- [ ] Projects tab or entry in nav
- [ ] List / create / edit project (name, brief, github_url, preview_url)
- [ ] Drag-drop / upload flow (same feel as milestones) for project docs
- [ ] Project Preview home: framed embed of `preview_url`
- [ ] Project chat UI (reuse streaming chat, scoped)
- [ ] Feedback UI: create, list, status updates

### 5. Hardening
- [ ] Cross-workspace access attempts return 404/403
- [ ] No project data in global knowledge/chat unless intended
- [ ] Deploy API (push → CI) + web redeploy when ready
- [ ] New EAS build for TestFlight when mobile UX is ready

---

## v1 slice order (implementation)

1. Theme infrastructure + Settings toggle  
2. Project model + API + tests  
3. Projects list/create UI  
4. Preview embed home  
5. Project docs + chat scoping  
6. Feedback  

---

## Out of scope for v1

- Auto-build preview from GitHub/CI  
- Auto milestones from feedback  
- Separate client-only chrome / reduced permissions  
- Multi-tenant billing  
