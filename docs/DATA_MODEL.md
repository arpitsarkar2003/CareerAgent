# Data Model — Career Agent

All tables live in Supabase Postgres. Schema changes go through
`supabase/migrations/` only — never manual dashboard edits. RLS is enabled
on every table. Auth is **Clerk** (not Supabase Auth): the browser never
uses a Supabase user JWT, so RLS denies public/`anon` access; `apps/api`
uses the service-role key (bypasses RLS) and filters rows by `user_id`
(Clerk user id string).

`apps/api` is the only service that talks to Supabase for data. `apps/web`
does not hold Supabase keys.

This is the target schema — actual migration files are written in Module 1.
See `docs/modules/01-scaffold/01-scaffold-supabase.md`.

## `knowledge_chunks`
The embedded knowledge base (resume, cover letters, project write-ups).

| column      | type          | notes                                  |
|-------------|---------------|-----------------------------------------|
| id          | uuid PK       |                                          |
| user_id     | text          | Clerk user id (e.g. `user_…`), not auth.users |
| source_type | text          | 'resume' \| 'cover_letter' \| 'project' \| 'note' |
| source_name | text          | e.g. filename or free label             |
| content     | text          | the chunk text                          |
| embedding   | vector(1536)  | pgvector, hnsw index, cosine ops        |
| metadata    | jsonb         | e.g. { role, company, dates, skills[] } |
| created_at  | timestamptz   |                                          |

## `job_postings`
A pasted/imported job posting.

| column       | type        | notes                          |
|--------------|-------------|----------------------------------|
| id           | uuid PK     |                                  |
| user_id      | text        | Clerk user id                    |
| company      | text        |                                  |
| title        | text        |                                  |
| url          | text        | nullable                        |
| raw_text     | text        | full posting text               |
| created_at   | timestamptz |                                  |

## `applications`
One row per application, links a job posting to generated drafts + status.

| column         | type        | notes                                          |
|----------------|-------------|--------------------------------------------------|
| id             | uuid PK     |                                                    |
| user_id        | text        | Clerk user id                                      |
| job_posting_id | uuid        | FK → job_postings                                 |
| status         | text        | 'drafted' \| 'applied' \| 'interview' \| 'rejected' \| 'offer' |
| resume_draft   | text        | tailored bullets/summary                          |
| cover_letter   | text        | drafted cover letter                              |
| notes          | text        | free-form, editable                               |
| applied_at     | timestamptz | nullable, set when status → 'applied'             |
| created_at     | timestamptz |                                                    |
| updated_at     | timestamptz |                                                    |

## `emails`
Incoming/outgoing email tied to an application (Module 5).

| column         | type        | notes                                  |
|----------------|-------------|-------------------------------------------|
| id             | uuid PK     |                                            |
| user_id        | text        | Clerk user id                              |
| application_id | uuid        | FK → applications, nullable if unmatched  |
| direction      | text        | 'inbound' \| 'outbound_draft' \| 'sent'   |
| subject        | text        |                                            |
| body           | text        |                                            |
| from_address   | text        |                                            |
| received_at    | timestamptz | nullable for drafts                       |
| created_at     | timestamptz |                                            |

## Indexes worth calling out
- `knowledge_chunks`: HNSW index on `embedding` (cosine distance).
- `applications`: index on `(user_id, status)` for dashboard queries.
- `emails`: index on `application_id`.

## Notes
- Embedding dimension (1536) assumes an OpenAI-family embedding model —
  confirm and lock this in Module 1 / the API AI config before creating the
  vector column, since changing it later means re-embedding everything.
- Foreign keys (Module 1): `applications.job_posting_id` → `job_postings(id)`
  `ON DELETE RESTRICT`; `emails.application_id` → `applications(id)` nullable
  `ON DELETE SET NULL`.
