# Implementer prompt — Module 1

Copy everything inside the fence below into another AI session (with this repo open / attached).

---

```
You are implementing Module 1 for Career Agent. Work ONLY from the written
specs in this repo. Do not invent product scope. Prefer contracts over
guesswork. Free-tier / low-cost only.

## Task
Implement Module 1 end-to-end per:
  docs/modules/01-scaffold/01-scaffold-supabase.md

Read these BEFORE writing code (in order):
  1. docs/modules/01-scaffold/01-scaffold-supabase.md   ← build contract (source of truth)
  2. docs/DATA_MODEL.md
  3. docs/ARCHITECTURE.md
  4. docs/ROADMAP.md
  5. CLAUDE.md
  6. docs/PRD.md (non-goals)

Also inspect the existing scaffold and reuse it; do not rewrite from scratch:
  - docker-compose.yml
  - apps/api/main.py, apps/api/supabase/, apps/api/routers/, apps/api/ai/
  - apps/api/.env.example
  - apps/web (Next.js App Router + Tectonic landing — do not redesign)
  - supabase/migrations/ (currently empty / .gitkeep)

## Locked decisions (do not reopen)
- Auth = Clerk (NOT Supabase Auth).
- Supabase = Postgres + pgvector only. Web never talks to Supabase.
- user_id on all tables = text (Clerk user id), NOT uuid FK to auth.users.
- Elevated DB access: prefer SUPABASE_SECRET_KEY (sb_secret_…). Accept legacy
  SUPABASE_SERVICE_ROLE_KEY as fallback if secret key unset / client rejects it.
- Do NOT require: SUPABASE_PUBLISHABLE_KEY, SUPABASE_JWKS_URL, NEXT_PUBLIC_SUPABASE_*,
  or a postgresql:// DSN as the primary app client path.
- RLS ON all tables; deny public/anon access. Ownership filtered in apps/api by
  user_id. Service/secret key bypasses RLS.
- embedding column = vector(1536). Do not change dimension.
- FKs: applications.job_posting_id ON DELETE RESTRICT;
  emails.application_id nullable ON DELETE SET NULL.
- No R2, no OpenRouter calls required for Module 1 pass, no email, no RAG,
  no knowledge upload UI.

## In scope (Module 1)
- Harden Compose if needed (web:3000, api:8000).
- SQL migration(s) under supabase/migrations/ for:
  knowledge_chunks, job_postings, applications, emails
  + vector extension + required indexes (HNSW cosine on embeddings;
    applications(user_id, status); emails(application_id))
  + RLS + deny policies for anon/authenticated.
- apps/api Supabase client from SUPABASE_URL + SUPABASE_SECRET_KEY (fallback
  SERVICE_ROLE_KEY). Fail clearly if missing.
- Minimal DB probe (e.g. GET /health/db or equivalent) — 503 if unreachable;
  never return secrets.
- Update env examples:
  - web: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_API_BASE_URL
  - api: SUPABASE_URL, SUPABASE_SECRET_KEY, CLERK_SECRET_KEY, WEB_ORIGIN
    (+ optional legacy SERVICE_ROLE note; AI keys optional placeholders)
- Document how you applied the migration (Supabase CLI linked project OR
  Dashboard SQL) in the PR / commit description.

## Out of scope (stop at Module 1)
- Knowledge ingestion / chunking / embeddings runtime (M2)
- AI provider adapters beyond stubs (M3)
- Job paste → RAG draft (M4)
- Email (M5)
- Deploy (M6)
- Full Clerk-protected app shell is optional/thin — env wiring required;
  gated product routes can wait for later modules unless trivial.
- Do not change Tectonic landing design except env wiring if needed.
- Do NOT check off ROADMAP Module 1 until acceptance criteria pass.

## Acceptance criteria (must all pass)
- docker compose up --build starts web + api without crash loops
- GET /health ok
- Migration applied on hosted free Supabase; four tables exist
- vector extension present; knowledge_chunks.embedding is vector(1536)
- RLS enabled; publishable/anon cannot read/write app data
- DB probe succeeds with valid SUPABASE_URL + secret
- Env examples match the Module 1 contract (no Supabase keys on web)
- No secrets committed; no Module 2–5 feature creep

## Env the human will fill (do not invent real keys)
apps/web/.env.local:
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

apps/api/.env:
  SUPABASE_URL=
  SUPABASE_SECRET_KEY=
  CLERK_SECRET_KEY=
  WEB_ORIGIN=http://localhost:3000

Clerk dashboard: allow http://localhost:3000

## How to work
1. Follow the module file strictly.
2. Smallest change set that meets acceptance.
3. If docs conflict with 01-scaffold/01-scaffold-supabase.md, the module file wins for M1;
   then note the drift.
4. When done, list files changed and how to verify (commands + checklist).
5. Do not push; do not commit secrets. Commit only if the human asks.
```

---
