# Data Model — Career Agent

All tables live in Supabase Postgres. Schema changes go through
`supabase/migrations/` only — never manual dashboard edits. RLS enabled on
every table, scoped to `auth.uid() = user_id` even though it's single-user
(good habit, cheap to add now, painful to retrofit).

`apps/api` is the only service that writes with the Supabase service-role key.
`apps/web` may use the anon key for auth state only.

This is the target schema — actual migration files are written in Module 1.

## `knowledge_chunks`
The embedded knowledge base (resume, cover letters, project write-ups).

| column      | type          | notes                                  |
|-------------|---------------|-----------------------------------------|
| id          | uuid PK       |                                          |
| user_id     | uuid          | FK → auth.users                         |
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
| user_id      | uuid        |                                  |
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
| user_id        | uuid        |                                                    |
| job_posting_id | uuid        | FK → job_postings                                 |
| status         | text        | 'drafted' \| 'applied' \| 'interview' \| 'rejected' \| 'offer' |
| resume_draft   | text        | tailored bullets/summary                          |
| cover_letter   | text        | drafted cover letter                              |
| notes          | text        | free-form, editable                               |
| applied_at     | timestamptz | nullable, set when status → 'applied'             |
| created_at     | timestamptz |                                                    |
| updated_at     | timestamptz |                                                    |

## `emails`
Incoming/outgoing email tied to an application (Module 4).

| column         | type        | notes                                  |
|----------------|-------------|-------------------------------------------|
| id             | uuid PK     |                                            |
| user_id        | uuid        |                                            |
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
- No hard foreign-key cascade decisions made yet (e.g. delete job_posting →
  what happens to application?) — will default to `ON DELETE RESTRICT` and
  revisit in Module 1 if needed.
