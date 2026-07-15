# PRD — Career Agent ("CareerOS")

## Problem
Job hunting means repeating the same work over and over: manually finding
postings across a dozen sites, re-explaining your background, tailoring the
same resume points to slightly different postings, tracking who you applied
to, and following up on emails. This is a personal system to compress all
of that, end to end, while keeping the risky or irreversible steps
(submitting, sending) under explicit human control.

## Vision / Goal
A private, single-user system that, on demand:

1. Searches multiple job sources for postings matching my profile.
2. Scores each posting against my profile using semantic understanding, not
   keyword matching, and discards anything below a threshold.
3. Researches the company behind any posting I'm interested in.
4. Drafts a tailored resume summary and cover letter — and answers to
   free-text questions like "tell us about yourself" or "why this
   company?" — grounded in my full career knowledge base and the company
   research.
5. Lets me review the scored list and choose, per posting, to auto-apply or
   apply manually.
6. For approved auto-apply postings, actually submits the application via
   browser automation running on my own machine.
7. Classifies incoming recruiter email, drafts replies, and drafts
   follow-ups when an application goes quiet — always leaving the actual
   send to me.
8. Tracks every application through its full lifecycle on one dashboard.
9. Prepares interview material and drafts salary-negotiation email when an
   offer arrives.
10. Lets me swap the underlying AI model/provider without touching app
    logic.

## Agents (v2 scope)

| # | Agent | Does |
|---|-------|------|
| 1 | Job Search | Searches configured sources for postings matching my profile |
| 2 | Scoring | Scores each posting (0–100%) against my profile; skips below threshold |
| 2b | Resume Brain | Holds my full career history; drafts tailored bullets and free-text answers |
| 3 | Company Research | Pulls funding, tech stack, founders, news, culture, products before drafting |
| 4 | Form Filling | Browser automation (via local runner) that logs in, fills forms, submits |
| 5 | Email | Classifies recruiter email, drafts replies |
| 6 | Follow-up | Drafts a follow-up after N days of no reply |
| 7 | Tracker | Dashboard of every application's status |
| 8 | Interview Prep | Fetches JD/company/stack, drafts likely questions |
| 9 | Salary Negotiation | Compares offer to market data, drafts negotiation email |

## Explicit non-goals (v2 — supersedes v1)

- **No unattended scheduling.** No cron, no background worker that runs by
  itself. Every search run and every apply run starts from an explicit
  click in the dashboard.
- **LinkedIn is never auto-submitted**, regardless of the global auto-apply
  setting. LinkedIn postings are always searched and scored like any other
  source, but always routed to the manual-review queue, because automated
  activity there carries real account-ban risk.
- **No server-side browser automation.** All Playwright-driven actions run
  through the local CareerOS Runner on my own machine, never inside the
  cloud API container.
- **No autonomous email sending.** Every outgoing reply is drafted and
  requires a manual send.
- **No autonomous follow-up sending.** Follow-ups are drafted automatically
  once an application has gone quiet, but still require my approval before
  sending — same gate as regular email.
- **No multi-user support** — single-user, personal use.

## Users
Just me.

## Core user flows

**Flow 1 — Build the knowledge base**
Upload resume, past cover letters, project write-ups → chunked, embedded,
stored in Supabase/pgvector. (Unchanged from v1.)

**Flow 2 — Run a search**
I click "Run search." Agent 1 searches the configured sources. Agent 2
scores each result against my profile (skills, location, experience,
semantic fit — not keyword matching) and discards anything under the
threshold. Surviving postings appear in the dashboard as scored,
unreviewed `job_postings`.

**Flow 3 — Review and decide**
I see the scored list. Per posting, I either mark it for auto-apply
(allowed sources only — never LinkedIn) or leave it for manual review.

**Flow 4 — Draft an application**
For a posting I'm proceeding with, Agent 3 researches the company, then
Resume Brain (RAG over the knowledge base plus that research) drafts
tailored resume bullets, a cover letter, and answers to any custom
questions. Saved to `applications` with status `drafted`.

**Flow 5 — Submit**
- **Auto-apply approved:** a task is queued for the local runner. My
  machine shows a native notification ("CareerOS wants to apply to N
  jobs — Start"); I click Start; Agent 4 (Playwright, attached to my
  existing logged-in Chrome) fills and submits the form; status →
  `applied`.
- **Manual:** I apply myself on the site and mark the status.

**Flow 6 — Track**
Dashboard (Agent 7) shows every application across its lifecycle:
`drafted → applied → oa → technical → hr → interview → offer / rejected`.

**Flow 7 — Handle email**
Agent 5 classifies inbound mail related to an application, drafts a reply.
I review and send manually.

**Flow 8 — Follow up**
Agent 6 detects an `applied` application with no reply after N days,
drafts a follow-up, notifies me. I approve, then it sends.

**Flow 9 — Interview prep**
On request (or as an interview date approaches), Agent 8 pulls the JD,
company research, and tech stack, and drafts likely questions (technical,
system design, behavioral, company-specific).

**Flow 10 — Negotiate**
When an application reaches `offer`, Agent 9 compares it against market/
Glassdoor/Levels.fyi-style data and drafts a negotiation email (same
manual-send gate as all email).

## Architecture constraint (see `ARCHITECTURE.md`)
Two cloud services (`apps/web`, `apps/api`) plus a new local component, the
**CareerOS Runner**, which handles all browser automation on my own
machine. The cloud API never runs a browser and never holds my job-board
session; the runner never holds Supabase or AI provider secrets. Auth is
Clerk. Supabase is Postgres + pgvector only. Default AI provider is
OpenRouter via a provider-agnostic adapter in `apps/api`.

## Success criteria (v2)
- A single click produces a scored, relevant list of new postings within a
  few minutes, with no false "0% match noise" flooding the list.
- Approving auto-apply on a batch of jobs results in real submissions
  without me touching the job site myself, for non-LinkedIn sources.
- LinkedIn postings never get auto-submitted, even by mistake.
- I never lose track of an application's status, including interview
  sub-stages (OA/HR/technical).
- Switching AI provider remains a config change, not a code rewrite.

## Open questions (revisit per module)
- **Runner trigger mode:** always-on menu-bar app that polls quietly, vs.
  opened by me on demand each time. Decide before the Form-Filling module
  is spec'd.
- **Source build order:** Greenhouse/Lever/Ashby first (public APIs, lowest
  risk, fastest to build), then company career pages, then browser-gated
  sources (LinkedIn, Wellfound, Naukri, Instahyre) via the runner.
- **Email source:** Gmail API vs. manual forwarding vs. dedicated inbox —
  decide at that module.
- **Interview-prep / negotiation data sources** (Glassdoor, Levels.fyi):
  scrape vs. manual input vs. skip for v2 — decide at those modules.