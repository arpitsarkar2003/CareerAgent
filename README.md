# Career Agent

Personal job-application assistant. Ingests resume/career history into a
Supabase (pgvector) knowledge base, matches/drafts applications to job
postings, and handles related email drafts. Auto-submission is **not** in
scope — the agent prepares, a human clicks submit.

## Stack

| Piece | Role |
|-------|------|
| `apps/web` | Next.js (App Router) — UI only |
| `apps/api` | FastAPI — AI/RAG, embeddings, Supabase access |
| Supabase | Postgres + pgvector + Auth |
| Docker Compose | Runs `web` + `api` locally |

Default AI provider: Cloudflare Workers AI, via a provider-agnostic adapter in `apps/api`.

## Docs

- [`CLAUDE.md`](./CLAUDE.md) — project conventions for agents/contributors
- [`docs/PRD.md`](./docs/PRD.md) — product goals and non-goals
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — schema
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — build order

## Current status

See [`docs/ROADMAP.md`](./docs/ROADMAP.md). Nothing scaffolded yet beyond docs.
