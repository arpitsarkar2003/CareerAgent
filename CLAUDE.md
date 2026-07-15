# Career Agent

Personal job-application assistant. Ingests my resume/career history into a
Supabase (pgvector) knowledge base, matches/drafts applications to job postings,
and handles related email drafts. Auto-submission is NOT in scope — the agent
prepares, a human clicks submit (job-board ToS safety).

## Stack

Two services, run via Docker Compose, plus hosted Supabase (DB) and Clerk (Auth):

- **apps/web** — Next.js (App Router, TypeScript). UI only. Calls the API
  service for anything involving AI, embeddings, or writes to Supabase.
  Auth via Clerk publishable key. Holds no elevated secrets.
- **apps/api** — FastAPI (Python). Owns all AI/RAG logic, embeddings,
  Supabase access, and Clerk session verification. Holds the Supabase
  service-role key, Clerk secret key, and AI provider keys.
- **Supabase** — Postgres + pgvector only (not app Auth). Only `apps/api`
  talks to it, with the service-role key.
- **Clerk** — Sign-in / session for the single user.

Default AI provider is OpenRouter, accessed through a provider-agnostic
adapter in `apps/api`, so switching to OpenAI or Anthropic directly later
is a config change, not a rewrite.

## Repo structure

At the root: this file, `docker-compose.yml`, a `docs/` folder holding the
product and architecture documentation, an `apps/` folder containing the
`web` and `api` services each with their own Dockerfile and env file, and a
`supabase/` folder holding versioned SQL migrations.

Inside `apps/web`: standard Next.js App Router layout, plus its own
`.env.local` containing only browser-safe values (Clerk publishable key,
the internal URL of the API service).

Inside `apps/api`: a FastAPI app organized into an `ai/` module (provider
adapters), a `db/` module (elevated Supabase client and queries — named `db`
so it does not shadow the `supabase` PyPI package), and a `routers/` module
(HTTP endpoints). Its own `.env` holds the Supabase secret key (or legacy
service-role), Clerk secret key, and all AI provider API keys — this file
never reaches the browser or the `web` container.

`docs/modules/` holds one short spec file per build module, written just
before that module is built.

## Conventions

- All schema changes go through `supabase/migrations/`, never manual
  dashboard edits.
- All AI calls in `apps/api` go through the `ai/` adapter layer — never call
  a provider SDK directly inside a router.
- `apps/web` never talks to Supabase or an AI provider directly — everything
  goes through `apps/api`.
- Secrets stay split by service. The service-role key, Clerk secret, and AI
  provider keys live only in `apps/api/.env`. `apps/web/.env.local` only
  ever holds browser-safe values (Clerk publishable key, API base URL).
- Read `docs/` before starting any module. `docs/ROADMAP.md` is the current
  build order.

## Current status

**Module 1 done** (scaffold + schema). See `docs/ROADMAP.md`.
Next: Module 2 only after `docs/modules/02-…md` exists.

Career Agent Supabase project ref: `imypinqvbhdjavuotenh` (never howie).
API DB client lives in `apps/api/db/` (avoids shadowing the `supabase` PyPI package).
Migration applied via Dashboard SQL from `supabase/migrations/20260715163507_module1_schema.sql`.