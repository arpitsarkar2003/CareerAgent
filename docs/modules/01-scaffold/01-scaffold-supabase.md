# Module 1 — Scaffold + Schema

**Status:** Done — acceptance passed (Compose + schema on Career Agent Supabase + `/health` + `/health/db`).  
**Cost posture:** Free tiers only (Clerk free, Supabase free, local Docker). No paid add-ons.  
**Auth decision (locked):** Clerk for login/session. Supabase is Postgres + pgvector only — do not enable or use Supabase Auth for this app.

This is a build contract for an implementer (human or AI). Prefer precise contracts over solution code. Do not paste full migrations or client implementations into this file.

---

## Goal

Ship a runnable local stack where:

1. `docker compose up` starts `apps/web` and `apps/api`.
2. Hosted free-tier Supabase holds the full target schema from `docs/DATA_MODEL.md` (with Clerk-adjusted `user_id`).
3. `apps/api` can talk to Supabase with the elevated secret key
   (`SUPABASE_SECRET_KEY` / `sb_secret_…`, or legacy `service_role` JWT).
4. Clerk keys are wired into env examples (full login UI can be thin or stubbed; auth middleware comes next modules if needed).
5. Migrations live under `supabase/migrations/` and are the only way schema changes land.

Success = schema applied + API health + API can confirm DB connectivity — not a polished product UI.

---

## In scope

- Confirm / harden Docker Compose for `web` + `api` (already started; fix gaps only).
- Create versioned SQL migration(s) for all tables in `DATA_MODEL.md`.
- Enable `vector` (pgvector) extension in migration.
- Indexes called out in `DATA_MODEL.md` (HNSW on embeddings, dashboard indexes).
- RLS enabled on all app tables with a policy stance that matches Clerk +
  elevated-secret-only API access (see Decisions).
- Supabase client module under `apps/api/db/` used by the API (create client from env; expose a way the rest of the app gets the client). Named `db` so it does not shadow the `supabase` PyPI package.
- A minimal API probe that proves Supabase connectivity (e.g. authenticated admin ping or trivial select) without leaking secrets.
- Update `.env.example` files for Clerk + Supabase (API) and Clerk + public API URL (web). No anon/service keys in web.
- Document how to apply migrations (Supabase Dashboard SQL editor, or Supabase CLI linked to the free project — pick one and document it in this module’s “How to verify” section when implementing; prefer CLI if already installed, else Dashboard for zero-cost simplicity).

## Out of scope

- Knowledge upload UI / chunking / embeddings (Module 2).
- AI provider adapters beyond what already exists as empty packages (Module 3).
- Job paste → RAG draft flow (Module 4).
- Email (Module 5).
- Deploy / production host (Module 6).
- Cloudflare R2 or any object storage.
- Supabase Auth, anon-key browser client, or frontend direct table access.
- Full Clerk-protected app shell (sign-in pages, middleware) — wire env + dependency readiness only unless trivial; real gated routes land with product modules.
- Changing the Tectonic landing design beyond what env/wiring requires.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Product goals / non-goals |
| `docs/ARCHITECTURE.md` | Two-service split, secrets split, RAG later |
| `docs/DATA_MODEL.md` | Canonical tables/columns (adjust `user_id` per Decisions below) |
| `docs/ROADMAP.md` | Module order |
| `CLAUDE.md` | Repo conventions |

Existing scaffold to reuse (do not reinvent):

- `docker-compose.yml` — web `:3000`, api `:8000`, hot reload volumes.
- `apps/api/main.py` — FastAPI + CORS + `/health`.
- `apps/api/db/`, `apps/api/ai/`, `apps/api/routers/` — packages present; fill as needed.
- `apps/web` — Next.js App Router + Tectonic landing already present.

---

## Decisions (locked for Module 1)

### Auth: Clerk

- Browser: Clerk publishable key only.
- API: Clerk secret key available for later session verification (Module 2+). Module 1 does not need to fully enforce JWT on every route yet, but env + example files must include it.
- Do **not** put `NEXT_PUBLIC_SUPABASE_*` on the web app.

### Identity columns

- `user_id` on all app tables is **text**, storing the Clerk user id string (e.g. `user_…`).
- **Not** a UUID FK to `auth.users`. No dependency on Supabase Auth schema.
- Indexes that included `user_id` still apply (type is text).

### RLS + elevated Supabase secret

- Enable RLS on every app table.
- Because the browser never talks to Supabase Data API with a user JWT, and
  only `apps/api` uses the elevated secret (`sb_secret_…` or legacy
  `service_role` JWT — both bypass RLS):
  - Add explicit deny-all (or no-grant) policies for `anon` / `authenticated`
    roles so direct public API access cannot read/write even if someone
    discovers the project URL.
  - Authorization for “which Clerk user owns which rows” is enforced in
    `apps/api` (filter by `user_id`), not via `auth.uid()` RLS.
- Single-user personal app: still store `user_id` on every row for
  future-proofing.

### Embeddings dimension

- Keep `vector(1536)` as in `DATA_MODEL.md`.
- Pinning the actual embedding model string is Module 3; Module 1 only creates the column width. Do not change dimension without a migration + re-embed plan.

### Foreign keys

- `applications.job_posting_id` → `job_postings.id` with `ON DELETE RESTRICT`.
- `emails.application_id` → `applications.id` nullable, `ON DELETE SET NULL` (unmatched/cleared mail allowed).

### Cascade / deletes

- No cascade-delete of applications when a job posting is removed (RESTRICT).
- Deleting knowledge chunks is row-level only; no cascade graph in Module 1.

### Free-tier ops

- One hosted Supabase free project (no self-hosted Postgres required).
- No Redis, no extra vector DB, no paid Clerk features.
- Local-only Compose for web/api.

---

## Deliverables

| Deliverable | Notes |
|-------------|--------|
| Migration SQL under `supabase/migrations/` | Timestamped filename; enable `extensions.vector` or `create extension if not exists vector`; create all four tables + indexes + RLS |
| `apps/api` Supabase client | Under `apps/api/db/`; constructed from `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (prefer); accept legacy `SUPABASE_SERVICE_ROLE_KEY` as fallback; fail clearly if neither is set |
| Connectivity check | Small route or health extension that fails closed if DB client cannot reach Supabase (no secrets in response body) |
| Env examples | See Env contract below |
| Docs alignment | `DATA_MODEL.md` / `ARCHITECTURE.md` / `ROADMAP.md` already updated for Clerk when this module ships — if drift appears, fix docs in the same PR as schema |

---

## Env contract

### `apps/web/.env.local` (browser-safe only)

| Variable | Required for M1 | Purpose |
|----------|-----------------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser SDK |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | API base, default `http://localhost:8000` |

Do **not** add Supabase URL or keys here.

### `apps/api/.env` (secrets)

| Variable | Required for M1 | Purpose |
|----------|-----------------|---------|
| `SUPABASE_URL` | Yes | Project URL, e.g. `https://xxxx.supabase.co` (must match dashboard exactly) |
| `SUPABASE_SECRET_KEY` | Yes (preferred) | New elevated key (`sb_secret_…`). Replaces legacy `service_role`. Bypasses RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Fallback only | Legacy JWT elevated key — use only if `SUPABASE_SECRET_KEY` is unset / client rejects new format |
| `CLERK_SECRET_KEY` | Yes (present even if unused in handlers yet) | Ready for auth verification |
| `WEB_ORIGIN` | Yes | CORS, default `http://localhost:3000` |

AI keys (`OPENROUTER_API_KEY`, etc.) may remain in `.env.example` as optional placeholders for later modules — not required to pass Module 1 acceptance.

### Do **not** require for this app (ignore if collected)

| Variable | Why skip |
|----------|----------|
| `SUPABASE_PUBLISHABLE_KEY` / anon key | Browser/Supabase Auth path — unused with Clerk; web never talks to Supabase |
| `SUPABASE_JWKS_URL` | Verifies Supabase Auth JWTs — Auth is Clerk |
| `postgresql://…` direct DB URL | Optional for SQL CLI/Dashboard; primary app path is URL + secret via Supabase client, not raw Postgres DSN in the API |

### Clerk dashboard

- Allow origin `http://localhost:3000` for local dev.

### Supabase dashboard

- Create free project.
- Enable / confirm **pgvector** (`vector` extension) — migration should create it if permitted.
- Do **not** configure Supabase Auth as the app’s login system.
- Prefer the new **secret** API key (`sb_secret_…`) from Project Settings → API Keys.

---

## Schema contract (implement exactly)

Tables: `knowledge_chunks`, `job_postings`, `applications`, `emails` — columns and enums as in `docs/DATA_MODEL.md`, except:

| Change from older drafts | New rule |
|--------------------------|----------|
| `user_id uuid` FK → `auth.users` | `user_id text not null` (Clerk id) |
| RLS via `auth.uid() = user_id` | RLS on; no public role access; ownership enforced in API |
| Web anon / publishable key | Removed from architecture for this app |
| Env `SUPABASE_SERVICE_ROLE_KEY` only | Prefer `SUPABASE_SECRET_KEY`; legacy name is fallback |

Indexes (required):

- HNSW on `knowledge_chunks.embedding` using cosine distance ops (as supported by pgvector on free Supabase).
- `(user_id, status)` on `applications`.
- `application_id` on `emails`.

Timestamps: `timestamptz`; `applications.updated_at` present (trigger optional in M1 — acceptable to set in application code later if no trigger yet; prefer a simple `updated_at` default/`now()` on insert at minimum).

---

## API surface for Module 1

Keep surface tiny:

| Endpoint | Behavior |
|----------|----------|
| `GET /health` | Already exists — stay alive check |
| One DB probe | e.g. `GET /health/db` or include `db: "ok"` only after a safe lightweight call — return 503 if Supabase unreachable |

No CRUD routers for knowledge/jobs/applications yet.

---

## Acceptance criteria

- [x] `docker compose up --build` starts web and api without crash loops.
- [x] `GET http://localhost:8000/health` returns ok.
- [x] Migration applied on the free Supabase project; all four tables visible.
- [x] `vector` extension present; `knowledge_chunks.embedding` is `vector(1536)`.
- [x] RLS enabled on all four tables; publishable/anon key (if someone uses it) cannot read/write app data.
- [x] API loads `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (or legacy service-role fallback) and the DB probe succeeds when credentials are valid.
- [x] Web `.env.example` / `.env.local` docs list Clerk publishable + API URL only (no Supabase).
- [x] API `.env.example` lists `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CLERK_SECRET_KEY`, `WEB_ORIGIN` (optional legacy `SUPABASE_SERVICE_ROLE_KEY` noted as fallback).
- [x] No Module 2–5 features slipped in.
- [x] Secrets not committed.

---

## How an implementer should work

1. Read this file + `DATA_MODEL.md` + `ARCHITECTURE.md`.
2. Apply migration to the user’s free Supabase project.
3. Fill envs (user supplies values; never invent real keys).
4. Implement client + probe; update env examples.
5. Verify acceptance checklist locally.
6. Check off Module 1 in `docs/ROADMAP.md` only after acceptance passes.
7. Stop. Do not start Module 2 until `docs/modules/02-…md` exists.

---

## How to verify

### Apply migration (chosen path: Dashboard SQL)

Do **not** use the howie Supabase project. Create a dedicated free Career Agent
project, then:

1. Open Supabase Dashboard → Project → SQL Editor.
2. Paste the contents of
   `supabase/migrations/20260715163507_module1_schema.sql`.
3. Run the script.
4. Confirm in Table Editor: `knowledge_chunks`, `job_postings`, `applications`,
   `emails`.
5. Confirm Extensions: `vector` enabled.
6. Fill `apps/api/.env` with that project's `SUPABASE_URL` +
   `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`).

### Local stack

```bash
docker compose up --build
curl -s http://localhost:8000/health          # {"status":"ok"}
curl -s http://localhost:8000/health/db       # {"status":"ok","db":"ok"} when envs set
```

---

## Open questions (resolved or deferred)

| Question | Resolution |
|----------|------------|
| Clerk vs Supabase Auth | **Clerk** |
| R2 in Module 1 | **No** |
| RLS with Clerk | Elevated-secret-only API + deny public roles; row filter in API |
| New vs legacy Supabase API keys | Prefer `SUPABASE_SECRET_KEY` (`sb_secret_…`); legacy `service_role` JWT ok as fallback |
| Email provider | Deferred to Module 5 |
| Embedding model string | Deferred to Module 3; dimension 1536 locked here |
| Apply migrations via CLI vs Dashboard | Implementer picks one free path and documents the chosen steps in the PR description |

---

## Non-goals reminder

No auto job-board submit, no scraping, no multi-tenant product, no autonomous email send — unchanged from `PRD.md`.
