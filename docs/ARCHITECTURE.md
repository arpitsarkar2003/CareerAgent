# Architecture — Career Agent

## High-level

Two services run via Docker Compose, plus a hosted Supabase project. The
browser never holds elevated secrets; all AI and privileged DB access lives
in the API.

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────┐
│  apps/web    │ ───▶ │  apps/api         │ ───▶ │   Supabase     │
│  Next.js UI  │      │  FastAPI          │      │ Postgres +     │
│  + Clerk     │ ◀─── │  AI / RAG / DB    │ ◀─── │ pgvector       │
│  (dashboard, │      │  + Clerk verify   │      │ (DB only)      │
│   editor)    │      │                   │      └───────────────┘
└──────┬───────┘      └────────┬──────────┘
       │                       │
       ▼                       ▼
┌──────────────┐       ┌───────────────┐
│    Clerk     │       │  ai/ adapters  │  ← provider-agnostic
│  (Auth)      │       │  (chat, embed) │
└──────────────┘       └───────┬───────┘
                               ▼
                  OpenRouter / OpenAI / Anthropic

                       ┌───────────────┐
                       │  email module  │  → Gmail API or Resend (Module 5)
                       │  (in apps/api) │
                       └───────────────┘
```

| Service | Role | Secrets |
|---------|------|---------|
| `apps/web` | UI only. Calls `apps/api` for AI, embeddings, and data writes. Auth via Clerk. | Browser: Clerk publishable key, API base URL. Server-only on web: `CLERK_SECRET_KEY` for Next middleware (never `NEXT_PUBLIC_`). Never Supabase or AI keys. |
| `apps/api` | Owns all AI/RAG logic, embeddings, elevated Supabase access, and Clerk session verification (product routes from Module 2+). | Supabase secret key (`SUPABASE_SECRET_KEY`) + Clerk secret + AI provider keys (`.env`) |
| Supabase | Postgres + pgvector (DB only — not app Auth) | Hosted free project; migrations in `supabase/migrations/` |
| Clerk | Sign-in / session for the single user | Publishable (web) + secret (web middleware + api) |

## Repo layout

```
/
├── docker-compose.yml
├── CLAUDE.md
├── docs/                  # PRD, architecture, data model, roadmap, module specs
├── apps/
│   ├── web/               # Next.js App Router (TypeScript)
│   │                      # app/ (routes) · features/ · services/ · components/
│   └── api/               # FastAPI (Python)
│       ├── ai/            # provider adapters
│       ├── db/            # Supabase elevated client + future queries
│       └── routers/       # HTTP endpoints the frontend calls
└── supabase/
    └── migrations/        # versioned SQL — never manual dashboard edits
```

## Key design decisions

### 1. Split UI and API (not a Next.js monolith)
`apps/web` is UI-only. It never talks to an AI provider or writes to Supabase
— everything data-related goes through `apps/api`. This keeps the
service-role key and provider API keys out of the browser and the web
container. Login uses Clerk in the browser; the API verifies Clerk sessions
when protecting routes.

### 2. One database, not a separate vector DB
Supabase Postgres + pgvector holds both relational data (applications, job
postings, email logs) and vector embeddings (resume/knowledge chunks) in one
place. At personal-project scale (hundreds–low thousands of vectors), a
dedicated vector DB (Pinecone/Weaviate/Qdrant) adds ops overhead with no
real benefit. Revisit only if the knowledge base grows past ~50k chunks or
query latency becomes a problem.

### 3. AI provider abstraction
All AI calls (chat completions + embeddings) go through `apps/api/ai/`,
never direct SDK calls inside routers. Interface (conceptual):

```python
class AIProvider(Protocol):
    async def chat(self, messages: list[ChatMessage], opts: ChatOptions | None = None) -> ChatResponse: ...
    async def embed(self, text: str) -> list[float]: ...
```

Default implementation wraps OpenRouter (single API, swap models via string
like `openai/gpt-4o` or `anthropic/claude-sonnet-4-5`). Direct OpenAI /
Anthropic providers can be added later without touching calling code — just
change which provider is instantiated via an env var
(`AI_PROVIDER=openrouter|openai|anthropic`).

**Embedding model stays fixed** even if the chat model changes — switching
embedding models requires re-embedding the whole knowledge base since vector
spaces aren't compatible across models. Pin this in the API AI config.

### 4. RAG flow for drafting an application
1. Job posting text → embed → similarity search against `knowledge_chunks`
   (top-k, e.g. 8–12 chunks).
2. Retrieved chunks + job posting + a drafting prompt → chat model →
   structured output (resume bullets + cover letter draft).
3. Draft stored against the `applications` row for editing.

All of this runs in `apps/api`; the web UI only displays and edits results.

### 5. Email handling — draft-only by design
The agent never sends email autonomously. It classifies/matches incoming
messages to an application, drafts a reply, and stops. Sending is a manual
action in the UI (or opens a mailto: / Gmail draft for me to review).
Email logic lives in `apps/api` (scheduled for Module 5).

### 6. Auth
Clerk, single user (me). Supabase is database only — no Supabase Auth for
this app. RLS is enabled on all tables and denies public/`anon` access;
`apps/api` uses the service-role key and scopes queries by Clerk `user_id`
(stored as text on each row). See `docs/modules/01-scaffold/01-scaffold-supabase.md`.

## Environments
- **Local dev**: Docker Compose for `web` + `api`, plus a free-tier hosted
  Supabase project (or Supabase local CLI if preferred later) and Clerk
  (free) with `http://localhost:3000` allowed.
- **Deploy**: containerized `web` + `api` (or equivalent hosting) + Supabase
  hosted project + Clerk. Exact host TBD in polish / deploy work.
- **Secrets**: split by service. `apps/api/.env` holds the Supabase
  secret key (`SUPABASE_SECRET_KEY`, or legacy service_role fallback), Clerk
  secret key, and AI provider keys. `apps/web/.env.local` holds Clerk
  publishable key, API base URL, and server-only `CLERK_SECRET_KEY` for
  Next middleware (never `NEXT_PUBLIC_`; never Supabase or AI keys on web).
  Never commit secrets — `.env.example` files document required vars with
  no values.
