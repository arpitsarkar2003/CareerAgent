# Roadmap — Career Agent ("CareerOS")

Build order. Each module gets its own spec in `docs/modules/NN-name.md`,
written just before we build it, then checked off here. This roadmap
supersedes the v1 list following the pivot to auto-search/auto-apply —
Module 1 is unaffected; everything after it is renumbered and expanded to
cover the 9-agent design.

- [x] **Module 1 — Scaffold + Supabase schema**
  Spec: `docs/modules/01-scaffold/01-scaffold-supabase.md`. Docker Compose
  for `apps/web` + `apps/api`, free-tier Supabase (DB + pgvector only),
  Clerk env wiring, migrations for v1 tables, RLS deny-public + API
  elevated client.

- [x] **Module 2 — Knowledge base ingestion**
  Upload flow for resume/cover letters/project notes → chunking →
  embedding → store in `knowledge_chunks`. Basic view/edit UI.
  Spec: `docs/modules/02-knowledge-base.md`.

- [x] **Module 3 — AI provider layer**
  `apps/api/ai/` adapter interface, Cloudflare Workers AI implementation
  (chat + embed), env-var provider switching, embedding model pinned +
  documented. Spec: `docs/modules/03-ai-provider.md`.

- [ ] **Module 4 — Job source connectors (API-based)**
  Greenhouse, Lever, Ashby connectors in `apps/api/sources/`. On-demand
  fetch only, no scheduler. Stores raw postings into `job_postings` with
  `source` set, unscored.

- [ ] **Module 5 — Scoring agent**
  Semantic profile-matching (skills, location, experience — not keyword
  matching) against `job_postings`, writes `score` + `score_reasoning`.
  Threshold cutoff; below-threshold postings are stored but hidden from
  the default review list.

- [ ] **Module 6 — Company research agent**
  Given a company name, gathers funding/tech stack/founders/news/culture/
  products/customers, caches in `company_research`.

- [ ] **Module 7 — Resume Brain + application drafting (RAG)**
  Extends the v1 RAG flow: retrieves knowledge chunks + company research →
  drafts tailored resume bullets, cover letter, and custom-question
  answers. Saves to `applications` (`status = 'drafted'`).

- [ ] **Module 8 — Review queue + dashboard**
  The scored-list UI: approve auto-apply per posting (never available for
  `source = 'linkedin'`), or send to manual review. Tracker view (Agent 7)
  across the expanded status pipeline (`drafted → applied → oa →
  technical → hr → interview → offer/rejected`).

- [ ] **Module 9 — CareerOS Runner + form-filling agent**
  Local runner app (Playwright, CDP-attach to my existing Chrome), scoped
  personal-access-token auth against `apps/api`, `runner_tasks` queue,
  native "Start" notification flow. Resolves the open question: always-on
  tray app vs. opened on demand.

- [ ] **Module 10 — Browser-gated job source connectors**
  LinkedIn, Wellfound, Naukri, Instahyre, and company career pages —
  searched through the runner (reusing Module 9's Chrome session), scored
  same as Module 5. LinkedIn results are hard-routed to manual review at
  the data layer, not just the UI.

- [ ] **Module 11 — Email agent**
  Decide email source (Gmail API vs. forwarding vs. dedicated inbox).
  Classify inbound email, match to application, draft reply. Manual send
  only.

- [ ] **Module 12 — Follow-up agent**
  Detects `applied` applications with no reply after N days, drafts a
  follow-up, notifies me, requires approval before send.

- [ ] **Module 13 — Interview prep agent**
  Given an application, fetches JD + company research + tech stack, drafts
  likely questions (technical, system design, behavioral, company-
  specific) into `interview_prep`.

- [ ] **Module 14 — Salary negotiation agent**
  On `status = 'offer'`, compares against market/Glassdoor/Levels.fyi-style
  data, drafts a negotiation email into `salary_negotiations`. Same
  manual-send gate as all email.

- [ ] **Module 15 — Polish + production deploy**
  Search/filter, notes, auth hardening, `applications.updated_at` trigger
  (owed since Module 1), deploy (containerized web + api + hosted
  Supabase; runner stays local regardless of host).

## Not scheduled (explicit non-goals, not just "later")
- Unattended/scheduled (cron) search or apply runs — every run is
  explicitly triggered.
- Auto-submitting on LinkedIn, under any setting.
- Server-side (cloud) browser automation — all Playwright execution stays
  on the local runner.
- Autonomous email or follow-up sending — both always require manual
  approval to send.
- Multi-user support.

## How to use this file
Update the checkbox when a module ships. If scope changes mid-module, note
it here rather than silently drifting from the spec in `docs/modules/`.