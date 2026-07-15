# Roadmap — Career Agent

Build order. Each module gets its own spec in `docs/modules/NN-name.md`,
written just before we build it, then checked off here.

- [x] **Module 1 — Scaffold + Supabase schema**
  Spec: `docs/modules/01-scaffold/01-scaffold-supabase.md`. Docker Compose for
  `apps/web` + `apps/api`, free-tier Supabase (DB + pgvector only),
  Clerk env wiring (Auth), migrations for all tables in `DATA_MODEL.md`,
  RLS deny-public + API elevated client in `apps/api/db/`.
  **M1.1:** Thin Clerk shell — landing Sign in/up, protected `/dashboard` stub
  (web middleware only; API JWT verify still deferred to Module 2).

- [ ] **Module 2 — Knowledge base ingestion**
  Upload flow (web UI → API) for resume/cover letters/project notes →
  chunking → embedding → store in `knowledge_chunks`. Basic
  "view/edit my knowledge base" UI under `/dashboard`.

- [ ] **Module 3 — AI provider layer**
  `apps/api/ai/` adapter interface, OpenRouter implementation, env-var
  based provider switching, embedding model pinned + documented.

- [ ] **Module 4 — Job posting → drafted application (RAG)**
  Paste job posting → API retrieves relevant knowledge chunks → drafts
  resume bullets + cover letter → save to `applications`. Basic
  dashboard (list + status) in `apps/web`.

- [ ] **Module 5 — Email handling**
  Decide email source (Gmail API vs. forwarding vs. dedicated inbox).
  Ingest inbound email in `apps/api` → match to application → draft
  reply → manual send/approve step in the UI.

- [ ] **Module 6 — Polish**
  Application status tracking UI, search/filter, notes, basic auth
  hardening, deploy (containerized web + api + hosted Supabase).

## Not scheduled (revisit later, not v1)
- Auto-submitting applications to job boards
- Scraping/browser-automation for job discovery
- Multi-user support

## How to use this file
Update the checkbox when a module ships. If scope changes mid-module, note
it here rather than silently drifting from the spec in `docs/modules/`.
