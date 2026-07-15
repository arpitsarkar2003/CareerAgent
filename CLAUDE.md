# Career Agent

Personal job-application assistant. Ingests my resume/career history into a
Supabase (pgvector) knowledge base, matches/drafts applications to job postings,
and handles related email drafts. Auto-submission is NOT in scope — the agent
prepares, a human clicks submit (job-board ToS safety).

## Stack

Two services, run via Docker Compose, plus a hosted Supabase project:

- **apps/web** — Next.js (App Router, TypeScript). UI only. Calls the API
  service for anything involving AI, embeddings, or writes to Supabase.
  Holds no secret keys.
- **apps/api** — FastAPI (Python). Owns all AI/RAG logic, embeddings, and
  Supabase access. Holds the Supabase service-role key and the AI provider
  keys. This is the only service with elevated privileges.
- **Supabase** — Postgres + pgvector + Auth. Shared by both services, but
  only `apps/api` writes to it with elevated permissions; `apps/web` may
  read with the public/anon key for auth state only.

Default AI provider is OpenRouter, accessed through a provider-agnostic
adapter in `apps/api`, so switching to OpenAI or Anthropic directly later
is a config change, not a rewrite.

## Repo structure

At the root: this file, `docker-compose.yml`, a `docs/` folder holding the
product and architecture documentation, an `apps/` folder containing the
`web` and `api` services each with their own Dockerfile and env file, and a
`supabase/` folder holding versioned SQL migrations.

Inside `apps/web`: standard Next.js App Router layout, plus its own
`.env.local` containing only browser-safe values (Supabase URL, Supabase
anon key, the internal URL of the API service).

Inside `apps/api`: a FastAPI app organized into an `ai/` module (provider
adapters), a `supabase/` module (DB client and queries), and a `routers/`
module (the actual HTTP endpoints the frontend calls). Its own `.env` holds
the Supabase service-role key and all AI provider API keys — this file never
reaches the browser or the `web` container.

`docs/modules/` holds one short spec file per build module, written just
before that module is built.

## Conventions

- All schema changes go through `supabase/migrations/`, never manual
  dashboard edits.
- All AI calls in `apps/api` go through the `ai/` adapter layer — never call
  a provider SDK directly inside a router.
- `apps/web` never talks to Supabase or an AI provider directly — everything
  goes through `apps/api`.
- Secrets stay split by service. The service-role key and AI provider keys
  live only in `apps/api/.env`. `apps/web/.env.local` only ever holds
  browser-safe values.
- Read `docs/` before starting any module. `docs/ROADMAP.md` is the current
  build order.

## Current status

See `docs/ROADMAP.md`.