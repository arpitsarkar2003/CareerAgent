# Data Model — Career Agent ("CareerOS")

All tables live in Supabase Postgres. Schema changes go through
`supabase/migrations/` only — never manual dashboard edits. RLS is enabled
on every table. Auth is **Clerk** (not Supabase Auth): the browser never
uses a Supabase user JWT, so RLS denies public/`anon` access; `apps/api`
uses the secret key (bypasses RLS) and filters rows by `user_id` (Clerk
user id string).

`apps/api` is the only service that talks to Supabase for data. Neither
`apps/web` nor the CareerOS Runner holds Supabase keys.

This is the target schema. Module 1 implemented `knowledge_chunks`,
`job_postings`, `applications`, and `emails` in their v1 shape below; the
new columns and tables marked **(v2)** are implemented as their respective
modules are built, not retroactively.

## `knowledge_chunks`
The embedded knowledge base (resume, cover letters, project write-ups).
Unchanged from v1.

| column      | type          | notes                                  |
|-------------|---------------|-----------------------------------------|
| id          | uuid PK       |                                          |
| user_id     | text          | Clerk user id                           |
| source_type | text          | 'resume' \| 'cover_letter' \| 'project' \| 'note' |
| source_name | text          | e.g. filename or free label             |
| content     | text          | the chunk text                          |
| embedding   | vector(1536)  | pgvector, hnsw index, cosine ops        |
| metadata    | jsonb         | e.g. { role, company, dates, skills[] } |
| created_at  | timestamptz   |                                          |

## `job_postings`
A job posting, whether pasted manually (v1) or discovered by Agent 1 (v2).

| column               | type        | notes                          |
|----------------------|-------------|----------------------------------|
| id                   | uuid PK     |                                  |
| user_id              | text        | Clerk user id                    |
| company              | text        |                                  |
| title                | text        |                                  |
| url                  | text        | nullable                        |
| raw_text             | text        | full posting text               |
| source               | text        | **(v2)** 'manual' \| 'linkedin' \| 'wellfound' \| 'greenhouse' \| 'lever' \| 'ashby' \| 'naukri' \| 'instahyre' \| 'company_page' |
| score                | numeric     | **(v2)** 0–100, from Agent 2; null for manually pasted postings not yet scored |
| score_reasoning      | jsonb       | **(v2)** structured match notes (skills matched, gaps, location/experience fit) |
| auto_apply_eligible  | boolean     | **(v2)** default `false`; app code must force this `false` for `source = 'linkedin'` regardless of any setting |
| discovered_at        | timestamptz | **(v2)** when Agent 1 found it (vs. `created_at` for manual paste) |
| created_at           | timestamptz |                                  |

## `applications`
One row per application, links a job posting to generated drafts + status.

| column              | type        | notes                                          |
|---------------------|-------------|--------------------------------------------------|
| id                  | uuid PK     |                                                    |
| user_id             | text        | Clerk user id                                      |
| job_posting_id      | uuid        | FK → job_postings, `ON DELETE RESTRICT`           |
| status              | text        | 'drafted' \| 'applied' \| 'oa' \| 'technical' \| 'hr' \| 'interview' \| 'rejected' \| 'offer' — **(v2)** expanded from v1's `applied`/`interview` to the finer pipeline stages Agent 7 tracks |
| resume_draft        | text        | tailored bullets/summary                          |
| cover_letter        | text        | drafted cover letter                              |
| custom_answers      | jsonb       | **(v2)** free-text Q&A pairs (e.g. "why us?") from Resume Brain |
| auto_submitted      | boolean     | **(v2)** true if Agent 4 / the runner submitted it, false if I applied manually |
| requires_manual_review | boolean  | **(v2)** true whenever `job_postings.source = 'linkedin'`; UI must not offer auto-apply when true |
| follow_up_status    | text        | **(v2)** null \| 'drafted' \| 'approved' \| 'sent' \| 'skipped' |
| follow_up_draft     | text        | **(v2)** Agent 6's drafted follow-up text          |
| follow_up_generated_at | timestamptz | **(v2)** nullable                              |
| notes               | text        | free-form, editable                               |
| applied_at          | timestamptz | nullable, set when status → 'applied'             |
| created_at          | timestamptz |                                                    |
| updated_at          | timestamptz | needs an actual update trigger (deferred since Module 1; still owed) |

## `emails`
Incoming/outgoing email tied to an application.

| column         | type        | notes                                  |
|----------------|-------------|--------------------------------------------|
| id             | uuid PK     |                                            |
| user_id        | text        | Clerk user id                              |
| application_id | uuid        | FK → applications, nullable if unmatched, `ON DELETE SET NULL` |
| direction      | text        | 'inbound' \| 'outbound_draft' \| 'sent'   |
| classification | text        | **(v2)** 'interview_invite' \| 'rejection' \| 'document_request' \| 'other', from Agent 5 |
| subject        | text        |                                            |
| body           | text        |                                            |
| from_address   | text        |                                            |
| received_at    | timestamptz | nullable for drafts                       |
| created_at     | timestamptz |                                            |

## `company_research` **(v2, new)**
Cached research per company, gathered by Agent 3 before drafting an
application; reused across multiple postings at the same company rather
than re-researched every time.

| column        | type        | notes                                              |
|---------------|-------------|-------------------------------------------------------|
| id            | uuid PK     |                                                        |
| user_id       | text        | Clerk user id                                          |
| company       | text        |                                                        |
| data          | jsonb       | funding, tech stack, founders, recent news, culture, Glassdoor notes, products, customers |
| researched_at | timestamptz |                                                        |

## `runner_tasks` **(v2, new)**
The task queue the CareerOS Runner polls. `apps/api` writes tasks; the
runner claims and completes them; the runner never talks to Supabase
directly.

| column        | type        | notes                                              |
|---------------|-------------|--------------------------------------------------------|
| id            | uuid PK     |                                                        |
| user_id       | text        | Clerk user id                                          |
| application_id| uuid        | FK → applications                                     |
| task_type     | text        | 'apply' (form-fill + submit)                          |
| status        | text        | 'pending' \| 'in_progress' \| 'done' \| 'failed'       |
| payload       | jsonb       | posting URL, form field mapping, resume/cover letter text to paste |
| error         | text        | nullable, populated on failure                        |
| created_at    | timestamptz |                                                        |
| completed_at  | timestamptz | nullable                                              |

## `runner_tokens` **(v2, new)**
Scoped personal access tokens issued to the CareerOS Runner. Only a hash
is stored; the raw token is shown once at issue time and lives only in the
runner's local config.

| column       | type        | notes                          |
|--------------|-------------|------------------------------------|
| id           | uuid PK     |                                     |
| user_id      | text        | Clerk user id                       |
| token_hash   | text        | never store the raw token           |
| created_at   | timestamptz |                                     |
| last_seen_at | timestamptz | nullable, updated on each poll      |
| revoked_at   | timestamptz | nullable                            |

## `interview_prep` **(v2, new)**
Agent 8's output per application.

| column       | type        | notes                                       |
|--------------|-------------|--------------------------------------------------|
| id           | uuid PK     |                                                    |
| user_id      | text        | Clerk user id                                      |
| application_id | uuid      | FK → applications                                 |
| content      | jsonb       | likely questions by category (technical, system design, behavioral, company-specific) |
| generated_at | timestamptz |                                                    |

## `salary_negotiations` **(v2, new)**
Agent 9's output when an application reaches `offer`.

| column        | type        | notes                                       |
|---------------|-------------|--------------------------------------------------|
| id            | uuid PK     |                                                    |
| user_id       | text        | Clerk user id                                      |
| application_id| uuid        | FK → applications                                 |
| market_data   | jsonb       | comparison inputs (market salary, location, experience level, source notes) |
| draft_email   | text        | drafted negotiation email — same manual-send gate as all email |
| generated_at  | timestamptz |                                                    |

## Indexes worth calling out
- `knowledge_chunks`: HNSW index on `embedding` (cosine distance).
- `applications`: index on `(user_id, status)` for dashboard queries.
- `emails`: index on `application_id`.
- `job_postings` **(v2)**: index on `(user_id, source, score)` for the
  review-queue view.
- `runner_tasks` **(v2)**: index on `(user_id, status)` for the runner's
  poll query.

## Notes
- Embedding dimension (1536) assumes an OpenAI-family embedding model,
  locked in Module 1 — do not change without a re-embed plan.
- Foreign keys: `applications.job_posting_id` → `job_postings(id)`
  `ON DELETE RESTRICT`; `emails.application_id` → `applications(id)`
  nullable `ON DELETE SET NULL`; `runner_tasks.application_id`,
  `interview_prep.application_id`, `salary_negotiations.application_id` →
  `applications(id)`, cascade behavior to be decided when those modules are
  spec'd.
- `applications.requires_manual_review` must be derived/enforced in
  `apps/api` application logic whenever `job_postings.source = 'linkedin'`
  — not just a UI-level default, so it can't be silently toggled off.
- `applications.updated_at` still needs a real update trigger (flagged
  since Module 1, not yet built) — becomes load-bearing once status starts
  moving through the expanded v2 pipeline stages.