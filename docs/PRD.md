# PRD — Career Agent

## Problem
Job hunting means repeating the same work over and over: re-explaining your
background, tailoring the same resume points to slightly different postings,
tracking who you applied to, and following up on emails. This is a personal
tool to compress that work.

## Goal
A private web app that:
1. Knows my full career history (resume, projects, achievements) via a
   searchable knowledge base.
2. Given a job posting, retrieves the most relevant parts of my history and
   drafts a tailored resume summary + cover letter.
3. Tracks every application (status, dates, notes) in one place.
4. Reads relevant incoming emails (recruiter replies, interview requests) and
   drafts responses for me to review and send.
5. Lets me swap the underlying AI model/provider without touching app logic.

## Explicit non-goals (v1)
- **No auto-submission** to job boards. Most boards' ToS prohibit automated
  applications, and bot detection risks flagging the account. The agent
  prepares everything; a human clicks submit.
- No multi-user support — this is single-user, for personal use.
- No browser-automation/scraping of job boards in v1 — postings are added
  manually (paste URL or text) until that's proven valuable.
- No autonomous email sending — every outgoing email is drafted and requires
  a manual send/approve step.

## Users
Just me.

## Core user flows

**Flow 1 — Build the knowledge base**
Upload resume, past cover letters, project write-ups → chunked, embedded,
stored in Supabase/pgvector.

**Flow 2 — Draft an application**
Paste a job posting (URL or text) → agent retrieves relevant knowledge base
chunks → drafts tailored resume bullet points + cover letter → I review/edit
→ save as an "application" record with status `drafted`.

**Flow 3 — Track applications**
Dashboard of all applications with status (`drafted`, `applied`, `interview`,
`rejected`, `offer`) and notes.

**Flow 4 — Handle email**
Incoming email (via connected inbox or forwarded manually) related to an
application → agent matches it to the application record → drafts a reply →
I review and send.

## Architecture constraint (see `ARCHITECTURE.md`)
Two services: `apps/web` (Next.js UI) and `apps/api` (FastAPI). Auth is
Clerk. The UI never calls AI providers or Supabase directly — everything
data-related goes through the API. Supabase is Postgres + pgvector only.
Default AI provider is OpenRouter via a provider-agnostic adapter in
`apps/api`.

## Success criteria (v1)
- I can paste a job posting and get a usable tailored draft in under a minute.
- I never lose track of an application's status.
- Switching AI provider is a config change in `apps/api`, not a code rewrite.

## Open questions (revisit per module)
- Email source: Gmail API (read/draft) vs. manual forwarding vs. a dedicated
  inbox address? → decide in Module 5.
- Job posting ingestion: manual paste only, or add scraping/browser-extension
  later? → default manual for v1.
