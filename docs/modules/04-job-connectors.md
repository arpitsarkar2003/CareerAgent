# Module 4 — Job Source Connectors (API-Based)

**Status:** Not started.
**Depends on:** Module 2 (dashboard shell, reusable components, API
conventions), Module 1 (`job_postings` schema).
**Unblocks:** Module 5 (scoring runs against what this module stores),
Module 10 (browser-gated sources follow the same normalized shape this
module establishes).

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full connector code or
migrations into this file — describe behavior in prose and tables.

---

## Goal

Ship the first working slice of Agent 1 (Job Search), limited to sources
that expose a public API and therefore carry the lowest ToS/detection
risk: Greenhouse, Lever, and Ashby. On an explicit click — never a
schedule — the system fetches current postings from these sources, stores
them into `job_postings` in a normalized shape, and shows them in a new
dashboard view. No scoring yet (Module 5), no browser automation
(Module 10) — this module proves the fetch-and-store loop end to end on
the sources where it's safest and fastest to get right.

---

## In scope

- A connector per source (Greenhouse, Lever, Ashby), each fetching
  postings relevant to configured search terms/roles/locations.
- A normalized posting shape all three connectors map into before
  storage, so scoring (Module 5) and the review UI never need to know
  which source a posting came from to process it.
- An explicit "Run search" action in the dashboard — a button, not a
  schedule — that triggers all configured connectors for that run.
- Deduplication: re-running a search should not create duplicate rows for
  postings already stored (match on source + a stable identifier from
  that source, e.g. its posting URL or native ID).
- Storage into `job_postings` with `source` set correctly and `score`
  left null (Module 5 fills it in).
- A basic "New postings" dashboard view listing what a search run found —
  unscored for now, just proving the data shows up correctly. This view
  gets extended into the full review queue in Module 8.
- Rate-limit-aware fetching per source (respect each API's documented
  limits; don't hammer them).

## Out of scope

- Scoring (Module 5) — this module stores postings with `score = null`.
- LinkedIn, Wellfound, Naukri, Instahyre, or company career pages
  (Module 10 — these need the runner, not a direct API call).
- Any scheduling/cron — every run is triggered by an explicit click, per
  the locked non-goal in `PRD.md`.
- Company research, drafting, or the full review/approve queue
  (Modules 6–8).
- Any browser automation of any kind — that's the runner's job starting
  Module 9.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Non-goals: no cron, LinkedIn/browser-gated sources deferred |
| `docs/ARCHITECTURE.md` | API-based vs. browser-gated source split |
| `docs/DATA_MODEL.md` | `job_postings` columns, incl. `source`, `score`, `discovered_at` |
| `docs/modules/02-knowledge-base.md` | Dashboard shell, reusable components, API conventions this module must follow |
| `docs/modules/03-ai-provider.md` | Not used directly here, but confirms scoring (which consumes this module's output) is a separate concern |

---

## Decisions (locked for Module 4)

### Trigger model
- A single "Run search" action in the dashboard fires all configured
  connectors for that run, sequentially or in parallel as the implementer
  prefers, and returns once all have completed or failed. No background
  job, no polling, no scheduled re-run — matches the locked "no cron"
  decision.

### Search terms / configuration
- Role keywords, locations, and experience-level filters are configured
  once (e.g. a simple settings area) rather than re-entered per run.
  Exact storage location (a settings table vs. a config file) is the
  implementer's call, but it must be editable without a code change.

### Normalized posting shape
- Every connector maps its source's native response into the same set of
  fields before storage: company, title, URL, raw posting text, source
  name. Connector-specific quirks (e.g. Lever's nested location object)
  are resolved inside that connector, never leaked into shared code.

### Deduplication
- Match on `(user_id, source, url)` at minimum; if a source's URL isn't
  stable, fall back to a source-native ID captured at fetch time. A
  re-run must not duplicate a posting already stored from a prior run.

### Rate limits and politeness
- Each connector respects its source's documented rate limits. If a
  source returns a rate-limit error mid-run, that connector's results for
  the run are marked partial/failed rather than silently dropped, and the
  UI reflects that a source didn't fully complete.

### API conventions
- Follows Module 2's established conventions exactly: versioned
  resource-oriented routes, consistent response envelope, pagination on
  the postings list endpoint, service-layer separation between the route
  handler and each connector's fetch logic.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Greenhouse connector | Fetch + normalize + dedupe |
| Lever connector | Fetch + normalize + dedupe |
| Ashby connector | Fetch + normalize + dedupe |
| Search configuration | Editable role/location/experience filters |
| "Run search" action | Dashboard trigger, no scheduling |
| Normalized storage | `job_postings` rows with `source`, `discovered_at`, `score = null` |
| "New postings" dashboard view | Lists what the latest run found, using Module 2's shell/components |

---

## Acceptance criteria

- [ ] Clicking "Run search" fetches from all three connectors and stores
  new postings with the correct `source` value.
- [ ] Running it again immediately produces no duplicate rows for
  postings already stored.
- [ ] A rate-limit or network failure on one connector doesn't prevent
  the other two from completing, and is visibly reported rather than
  silently swallowed.
- [ ] The "New postings" view renders using the Module 2 dashboard shell
  and reusable components — not a one-off layout.
- [ ] No scoring, drafting, LinkedIn/browser-gated source, or scheduling
  logic is present.
- [ ] List endpoint supports pagination per Module 2's API conventions.

---

## How an implementer should work

1. Read this file, `DATA_MODEL.md`'s `job_postings` section, and Module
   2's API-convention section.
2. Build the normalized posting shape first, independent of any
   connector.
3. Implement the three connectors against that shape.
4. Wire the "Run search" action, dedup logic, and storage.
5. Build the "New postings" view reusing Module 2's shell/components.
6. Verify acceptance criteria, including the duplicate-run and
   partial-failure cases.
7. Stop. Do not start Module 5 until its own spec exists.

## How to verify

1. Configure search terms, click "Run search," confirm postings appear
   in Supabase with correct `source`/`discovered_at`/`score = null`.
2. Click "Run search" again with no config changes, confirm no duplicate
   rows.
3. Temporarily break one connector's credentials/URL and confirm the
   other two still complete, with the failure visible in the UI.
4. Confirm the "New postings" view matches the dashboard's existing look
   and reuses the shared component set.

---

## Open questions

| Question | Resolution |
|----------|------------|
| Parallel vs. sequential connector fetching | Implementer's choice |
| Where search-term config is stored | Implementer's choice, must be editable without a code change |
| Exact dedup key per source if URLs are unstable | Document the chosen fallback per connector in the PR |

---

## Non-goals reminder

No scoring, no LinkedIn/Wellfound/Naukri/Instahyre/company-page sources,
no scheduling, no browser automation in this module — unchanged from
`PRD.md`.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/04-job-connectors.md` in full, along with
> `docs/PRD.md` (note the no-cron and browser-automation non-goals),
> `docs/DATA_MODEL.md` for the `job_postings` shape, and
> `docs/modules/02-knowledge-base.md` for the dashboard shell and API
> conventions to reuse. Implement Module 4 exactly as specced: Greenhouse,
> Lever, and Ashby connectors mapping into one normalized posting shape,
> an explicit "Run search" dashboard action with no scheduling, dedup
> logic so re-running doesn't create duplicates, per-connector
> rate-limit/failure isolation, and a "New postings" view built on the
> existing dashboard shell and reusable components. Do not implement
> scoring, LinkedIn or other browser-gated sources, or anything under "Out
> of scope." If any decision here seems wrong or you need to deviate, stop
> and ask me before proceeding. When done, walk through the acceptance
> criteria checklist and tell me the status of each item.
