# Architecture — Career Agent ("CareerOS")

## High-level

Three components: two cloud services behind Docker Compose / Vercel (as
before), plus a new **local component that runs on my own machine** and
only wakes up when there's browser-automation work to do. The cloud API
never runs a browser and never holds my job-board session cookies; the
local runner never holds Supabase, Clerk, or AI provider secrets.

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────┐
│  apps/web    │ ───▶ │  apps/api         │ ───▶ │   Supabase     │
│  Next.js UI  │      │  FastAPI          │      │ Postgres +     │
│  + Clerk     │ ◀─── │  AI / RAG / DB    │ ◀─── │ pgvector       │
│  (dashboard, │      │  + Clerk verify   │      │ (DB only)      │
│   editor)    │      │  + task queue     │      └───────────────┘
└──────┬───────┘      └────────┬──────────┘
       │                       │  polls for pending tasks
       ▼                       │  (scoped runner token, not
┌──────────────┐               │   a Supabase/Clerk secret)
│    Clerk     │               ▼
│  (Auth)      │      ┌───────────────────┐
└──────────────┘      │  CareerOS Runner   │  ← runs on my machine
                       │  (Playwright,      │    only when there's work
                       │   attaches to my   │
                       │   existing Chrome  │
                       │   via CDP)         │
                       └───────────────────┘

                       ┌───────────────┐
                       │  ai/ adapters  │  ← provider-agnostic
                       │ (chat, embed)  │
                       └───────┬───────┘
                               ▼
                  OpenRouter / OpenAI / Anthropic

                       ┌───────────────┐
                       │  email module  │  → Gmail API or Resend
                       │  (in apps/api) │
                       └───────────────┘
```

| Component | Role | Secrets |
|-----------|------|---------|
| `apps/web` | UI only. Calls `apps/api` for AI, embeddings, data writes, and triggering search/apply runs. Auth via Clerk. | Browser: Clerk publishable key, API base URL. Server-only on web: `CLERK_SECRET_KEY`. Never Supabase, AI, or runner keys. |
| `apps/api` | Owns all AI/RAG logic, embeddings, elevated Supabase access, Clerk session verification, scoring, company research, and a task queue for the runner. | Supabase secret key + Clerk secret + AI provider keys (`.env`) |
| Supabase | Postgres + pgvector (DB only) | Hosted free project; migrations in `supabase/migrations/` |
| Clerk | Sign-in / session for the single user | Publishable (web) + secret (web middleware + api) |
| **CareerOS Runner** | Local process on my machine. Polls `apps/api` for pending tasks (apply-to-job), drives Playwright against my real, already-logged-in Chrome to fill and submit forms, reports results back. | A single scoped personal access token issued by `apps/api`, stored only in the runner's local config. **Never** the Supabase secret, Clerk secret, or AI keys. |

## Repo layout

```
/
├── docker-compose.yml
├── CLAUDE.md
├── docs/                  # PRD, architecture, data model, roadmap, module specs
├── apps/
│   ├── web/               # Next.js App Router (TypeScript)
│   ├── api/               # FastAPI (Python)
│   │   ├── ai/            # provider adapters
│   │   ├── db/            # Supabase elevated client + queries
│   │   ├── sources/       # per-job-board connectors (API-based + browser-gated)
│   │   ├── scoring/        # profile-matching / scoring logic
│   │   ├── research/       # company research agent
│   │   └── routers/        # HTTP endpoints, incl. runner task-queue endpoints
│   └── runner/            # CareerOS Runner (separate small app, not in Compose)
└── supabase/
    └── migrations/         # versioned SQL — never manual dashboard edits
```

`apps/runner` is intentionally **not** part of `docker-compose.yml` — it's
a standalone process meant to run natively on my machine (so it can attach
to my real Chrome), not inside a container on a server.

## Key design decisions

### 1. Split UI, API, and execution (three-part, not two)
`apps/web` is UI-only, `apps/api` owns all AI/RAG/data logic, and the new
**runner** is a separate execution backend that only handles browser
automation. The API treats "who executes an apply task" as pluggable: today
it's my local runner; if this ever becomes multi-user or a SaaS product,
the same task queue could be served by cloud workers instead, without
changing `apps/web` or `apps/api`.

### 2. On-demand only — no scheduler, no cron
Every job search and every apply run is triggered by an explicit click in
the dashboard. `apps/api` does no background polling of job sites on its
own, and there's no scheduled job anywhere in the system. This keeps the
free-tier / no-always-on-infra posture from Module 1 intact — the only
thing that "runs in the background" is the runner briefly polling `apps/api`
for pending tasks, and only while it's open.

### 3. Two kinds of job sources
- **API-based connectors** (Greenhouse, Lever, Ashby): `apps/api` calls
  these directly over HTTP. No browser needed, no runner involved, lowest
  risk (these platforms expect programmatic access).
- **Browser-gated connectors** (LinkedIn, Wellfound, Naukri, Instahyre,
  most company career pages): require a logged-in session and are best
  driven through the runner, reusing my real Chrome session, since these
  sites actively watch for non-browser automated traffic.

### 4. The runner attaches to my real Chrome — it doesn't launch a fresh one
Rather than spawning an isolated Chromium (which means logging in again and
looks obviously automated), the runner connects to a Chrome instance I
already have open, launched once with remote debugging enabled, via
Playwright's CDP-attach mode. This means a one-time local setup step (a
shortcut that launches Chrome with the debug flag) rather than "double-
click and it works with my everyday Chrome icon" — worth knowing going in.

### 5. Runner auth is a scoped token, not a shared secret
The runner authenticates to `apps/api` with its own long random personal
access token, generated once and stored only in the runner's local config.
It never sees the Supabase secret key, the Clerk secret key, or AI provider
keys — it only ever talks to `apps/api`, never to Supabase directly. Flow:
web enqueues an "apply" task → `apps/api` stores it (`pending`) → runner
polls `apps/api` (not Supabase) for pending tasks → executes via Playwright
→ posts the result back to `apps/api` → `apps/api` writes to Supabase.

### 6. Auto-apply is a per-source setting, with a hard-coded LinkedIn exception
Every job source has an auto-apply-eligible flag I control, except
LinkedIn, which is always routed to manual review in application code —
not just a default setting, so it can't be silently switched on.

### 7. One database, not a separate vector DB
Unchanged from v1: Supabase Postgres + pgvector holds both relational data
and embeddings. Revisit only if the knowledge base grows past roughly 50k
chunks or query latency becomes a problem.

### 8. AI provider abstraction
All AI calls go through `apps/api/ai/`, never direct SDKs inside routers.
Module 2 ships a narrow `embed_text()` using **Cloudflare Workers AI**
(`@cf/baai/bge-large-en-v1.5`, 1024-dim) for free-tier embeddings
(`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`). Module 3 replaces that
with a provider-agnostic adapter (`chat` + `embed`, `AI_PROVIDER` switch).
Embedding model/dimension stays fixed independent of the chat model —
switching either requires re-embedding the whole knowledge base.

### 9. RAG flow for drafting an application (extended)
1. Company research (funding, tech stack, news, culture) is gathered and
   cached per company.
2. Job posting text → embed → similarity search against `knowledge_chunks`
   (top-k, e.g. 8–12 chunks).
3. Retrieved chunks + job posting + company research + a drafting prompt →
   chat model → structured output (resume bullets, cover letter, and
   answers to any custom application questions).
4. Draft stored against the `applications` row for editing.

All of this runs in `apps/api`; the web UI only displays and edits results.

### 10. Email and follow-ups — draft-only, human sends
Unchanged principle from v1, extended to follow-ups: the agent never sends
email autonomously. It classifies/matches incoming messages, drafts a
reply (or, for a quiet application, drafts a follow-up after N days),
notifies me, and stops. Sending is always a manual action in the UI.

### 11. Auth
Clerk, single user (me). Supabase is database only. RLS is enabled on all
tables and denies public/`anon` access; `apps/api` uses the secret key and
scopes queries by Clerk `user_id` (text on each row).

## Environments
- **Local dev**: Docker Compose for `web` + `api`, a free-tier hosted
  Supabase project, Clerk (free), and the `apps/runner` process run
  natively on my machine (outside Compose).
- **Deploy**: containerized `web` + `api` + hosted Supabase + Clerk, exact
  host TBD in polish/deploy work. The runner stays local regardless of
  where `web`/`api` are hosted.
- **Secrets**: split by component, not just by service.
  - `apps/api/.env`: Supabase secret key, Clerk secret key, AI provider
    keys.
  - `apps/web/.env.local`: Clerk publishable key, API base URL,
    server-only `CLERK_SECRET_KEY` for middleware.
  - `apps/runner/` local config: one scoped personal access token issued
    by `apps/api`. Nothing else.
  - Never commit secrets — `.env.example` files document required vars
    with no values.