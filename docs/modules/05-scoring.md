# Module 5 — Scoring Agent

**Status:** Done.
**Depends on:** Module 4 (postings to score already land in `job_postings`
with `score = null`), Module 3 (AI adapter's chat capability), Module 2
(dashboard shell, reusable components, API conventions).
**Unblocks:** Module 8 (review queue filters/sorts by score), Module 7
(Resume Brain only drafts for postings I've decided to proceed with, which
in practice means scored ones).

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full prompts, scoring code, or
migrations into this file — describe behavior in prose and tables.

---

## Goal

Turn Module 4's unscored "New postings" list into an actually useful
signal: every posting gets a 0–100 score against my profile — using
semantic judgment (skills, location, experience fit), not keyword
matching — plus a short structured reason. Anything below a threshold is
stored but hidden from the default view so the list stays worth reading.

Success = after a search run, I open the dashboard and the list is
already sorted by relevance, with obvious visual signal for why each one
scored the way it did, and nothing below my bar cluttering the default
view.

---

## In scope

- A scoring service in `apps/api` that takes my profile (derived from
  `knowledge_chunks`) and a posting's `raw_text`, and produces a 0–100
  score plus structured reasoning via the AI adapter's chat capability
  (Module 3) — not embedding-similarity ranking alone, since the
  reasoning breakdown (skills matched/missing, location fit, experience
  fit) needs semantic judgment, not just a similarity number.
- Scoring runs automatically as the next step after a search run
  completes (Module 4's "Run search" action) — no separate button for
  the common case, though a per-posting "Retry scoring" action exists for
  failures.
- A condensed **profile summary** built from my `resume`-type knowledge
  chunks (skills/summary/role chunks) — not the entire knowledge base —
  used as the scoring context, to keep each call small and fast.
- Storing `score` and `score_reasoning` on `job_postings` per
  `DATA_MODEL.md`.
- A configurable score threshold (default 80), stored alongside Module
  4's search configuration, editable without a code change.
- Extending the "New postings" view into a real scored list: sorted by
  score descending, below-threshold postings hidden by default with a
  toggle to reveal them, expandable reasoning per posting, visible
  progress feedback while a batch scoring run is in flight.
- Per-posting failure isolation: if scoring one posting fails after AI
  adapter retries, it's left with `score = null` and a visible "scoring
  failed" state with a retry action — one failure never blocks the rest
  of the batch.

## Out of scope

- Company research (Module 6) — scoring uses only the posting text and my
  profile, not company data.
- Application drafting (Module 7).
- Auto-apply approval UI, LinkedIn-specific manual-review routing beyond
  what already exists (Module 8 builds the full review/approve queue on
  top of this).
- Re-scoring on a schedule or in the background — scoring only runs as
  part of an explicit search run, or an explicit per-posting retry.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Agent 2 description, threshold-skip behavior |
| `docs/DATA_MODEL.md` | `job_postings.score` / `score_reasoning` columns |
| `docs/modules/03-ai-provider.md` | Chat capability, typed failure surface to reuse |
| `docs/modules/04-job-connectors.md` | Where postings come from, "New postings" view being extended |
| `docs/modules/02-knowledge-base.md` | Reusable components, API conventions |

---

## Decisions (locked for Module 5)

### Scoring method
- One chat-model call per posting via the Module 3 adapter, prompted to
  return structured output: a 0–100 score, a list of matched skills, a
  list of gap skills, a location-fit note, and an experience-fit note.
- Embedding similarity is not used as the scoring mechanism itself —
  it's a poor fit for producing human-readable reasoning. (It may be
  reused later as a cheap pre-filter if scoring volume becomes a cost
  problem — not needed at today's volume.)

### Profile summary
- Built from `knowledge_chunks` where `source_type = 'resume'` only —
  skills, summary, and role/experience chunks. Cover letters, projects,
  and notes are not included in the scoring context; they matter for
  drafting (Module 7), not for a fast skills/location/experience match.
- Rebuilt fresh per scoring run (not cached) so knowledge-base edits are
  always reflected immediately.

### Threshold
- Default 80 (as previously discussed), stored as an editable setting
  alongside Module 4's search configuration — same "must be editable
  without a code change" rule.
- Below-threshold postings are stored, never deleted, and hidden from the
  default dashboard view only — a toggle reveals them.

### Trigger and failure isolation
- Scoring runs as the automatic next step of a search run — from my
  perspective, "Run search" now means "search, then score," one flow.
- If a specific posting's scoring call fails after the adapter's retries
  are exhausted, that posting keeps `score = null`, is visibly flagged as
  "scoring failed" in the UI, and gets a manual "Retry scoring" action.
  Other postings in the same batch are unaffected.

### Progress model: client-orchestrated
- `POST /api/v1/search/runs` stays a single request that runs the
  connectors and returns the resulting posting IDs — it does not also
  block on scoring all of them, and there is no SSE/streaming/background
  job anywhere in this flow.
- After that response comes back, the web client calls the same
  per-posting scoring endpoint (the one also used for Retry) once per
  returned ID, sequentially, updating a simple "Scoring N of M…" progress
  readout as each call resolves. This keeps one shared scoring service/
  endpoint used by both the run-search flow and standalone retries,
  rather than two separate code paths.
- If the browser is closed or navigated away mid-batch, nothing is lost —
  postings not yet scored simply remain `score = null` and are picked up
  by the same retry mechanism the next time the list is viewed.

---

## UX

Builds on Module 2's shell and component set — no new visual language,
just new components added to the existing library.

### Posting card (extends Module 4's "New postings" card)
- **Score badge**: prominent, color-coded — e.g. a clear "passed
  threshold" treatment vs. a muted/neutral one for below-threshold cards
  shown via the toggle. Reuse existing accent color for "good match";
  don't introduce a new competing color family for this alone.
- **Expandable reasoning**: collapsed by default (skills matched, skills
  missing, location fit, experience fit); expands inline, doesn't
  navigate away from the list.
- **Failed-scoring state**: a distinct, calm state (not an error-red
  panic state) with a "Retry scoring" action inline on the card.

### List-level controls
- Sort: score descending by default.
- **"Show below-threshold" toggle**: off by default. New reusable
  **Toggle/Switch** component, added to the shared component set from
  Module 2.
- **Progress feedback during a scoring run**: a simple, honest indicator
  ("Scoring 8 of 20…") rather than a bare spinner — this can take real
  seconds per posting and a silent wait feels broken.
- **Empty state**: when a run produces postings but all fall below
  threshold, an explicit message ("Nothing over your threshold this run —
  lower it, or check below-threshold results") rather than a blank list
  that looks like nothing happened.

### Reusable component additions
- **Badge** (score / status indicator)
- **Toggle/Switch** (show/hide below-threshold)

Both go into the same shared location as Module 2's component set, for
reuse by later modules (Module 8's review queue will want the same
Badge/Toggle patterns).

---

## API conventions

Follows Module 2's established conventions exactly — versioned
resource-oriented routes, consistent response envelope, pagination,
service-layer separation. Specifically for this module:
- `POST /api/v1/search/runs` returns once connectors finish and postings
  are stored — it does not block on scoring. Scoring is driven by the
  client calling the per-posting scoring endpoint for each returned ID,
  per the Progress model decision above.
- The postings list endpoint gains query support for score threshold
  filtering and sort order, rather than the client fetching everything
  and filtering client-side.
- Scoring itself is a service function callable both from the per-posting
  scoring endpoint (used by the client's post-search loop) and from a
  single-posting retry endpoint — not logic duplicated between the two
  call sites.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Scoring service | Profile summary build + one chat call per posting + structured parse |
| Threshold setting | Editable, defaults to 80 |
| Auto-score-after-search | Wired into Module 4's "Run search" flow |
| Per-posting retry endpoint | For posts with `score = null` after a failed attempt |
| Scored list UI | Sort by score, below-threshold hidden + toggle, expandable reasoning |
| Progress feedback UI | Visible during an in-flight scoring batch |
| Badge + Toggle components | Added to the shared component set |

---

## Acceptance criteria

- [x] After "Run search" completes, every fetched posting has either a
  score + reasoning, or a visible "scoring failed" state — never a
  silent null with no explanation.
- [x] Postings below threshold are hidden by default and appear when the
  toggle is switched on; none are deleted.
- [x] The list is sorted by score descending by default.
- [x] A forced scoring failure (e.g. temporarily bad AI credentials) on
  one posting doesn't stop the rest of the batch from scoring, and shows
  a working "Retry scoring" action on the failed one.
- [x] Changing the threshold setting changes which postings show by
  default without a code change or redeploy.
- [x] Scoring uses only `resume`-type knowledge chunks for the profile
  context, not the full knowledge base.
- [x] No company research, drafting, or auto-apply logic is present.

---

## How an implementer should work

1. Read this file, `DATA_MODEL.md`'s `job_postings` scoring columns, and
   Module 3's adapter/failure-handling sections.
2. Build the profile-summary function first, independent of any specific
   posting.
3. Build the scoring service (one posting in, score + reasoning out),
   using Module 3's chat capability and typed failure surface.
4. Wire it as the automatic next step after Module 4's search run;
   add the standalone per-posting retry endpoint.
5. Extend the "New postings" UI: sort, hide/reveal toggle, expandable
   reasoning, progress feedback, failed state + retry.
6. Add Badge and Toggle to the shared component set.
7. Verify acceptance criteria, including the forced-failure case.
8. Stop. Do not start Module 6 until its own spec exists.

## How to verify

1. Run a search, confirm every resulting posting ends up with a score or
   a clearly flagged failure — check Supabase directly to confirm no
   posting is left in an ambiguous state.
2. Confirm postings below the threshold don't show by default, and do
   show once the toggle is switched on.
3. Change the threshold setting and confirm the default view updates
   accordingly without redeploying.
4. Temporarily break the AI provider credentials, run a search, confirm
   scoring fails visibly per-posting with a working retry action, and
   that unaffected postings still scored fine before the break (or use a
   forced single-call failure if testing this way is easier).
5. Confirm the profile summary only pulls from `resume`-type chunks
   (add a distinctive note-only chunk and confirm it doesn't influence
   scoring).

---

## Open questions

| Question | Resolution |
|----------|------------|
| Exact scoring prompt structure/wording | Implementer's call; must reliably produce parseable structured output |
| Embedding-based pre-filter before chat scoring | Deferred — only revisit if per-run AI cost/time becomes a real problem |
| Per-posting re-score after a knowledge-base edit | Deferred — not required for v2 acceptance; today's flow always re-scores fresh per search run |

---

## Non-goals reminder

No company research, drafting, auto-apply approval, or scheduled
re-scoring in this module — unchanged from `PRD.md`.

---

## Shipped notes (post-acceptance)

- Migration: `supabase/migrations/20260717130000_module5_score_threshold.sql`
  — adds `search_configs.score_threshold` (default 80, 0–100 check).
  Applied to project `imypinqvbhdjavuotenh`. `job_postings.score` /
  `score_reasoning` already existed from Module 4.
- Scoring service: `apps/api/services/scoring.py` —
  `build_profile_summary(user_id)` (resume-only chunks, rebuilt fresh,
  ~14k char cap) and `score_posting(user_id, posting_id)` (one chat call,
  strict JSON parse, clamps score 0–100, writes `score` +
  `score_reasoning`). Shared by both call sites — no duplicated scoring
  logic.
- Routes: `GET /api/v1/search/postings/{id}` (fetch one posting — used by
  the UI to show a failed card's details even off the current filtered
  page), `POST /api/v1/search/postings/{id}/score` (score/retry, used by
  both the post-search loop and the standalone Retry action).
  `GET /api/v1/search/postings` gained `min_score` and `include_unscored`
  query params; default sort is now `score desc, discovered_at desc`.
  `PUT /api/v1/search/config` gained `score_threshold`.
- `POST /api/v1/search/runs` returns `scoring_queue: string[]` (newly
  inserted posting IDs only — never duplicates) instead of scoring
  anything itself, per the locked client-orchestrated progress model.
- Typed failure surface: registered a `ProviderError` → API-envelope
  exception handler in `apps/api/errors.py` so an AI adapter failure
  (budget, bad credentials, unparseable response) surfaces as a clear
  `provider_error` with a real message, not a bare 500.
- **Adapter fix (Module 3 scope, discovered while verifying Module 5):**
  the default chat model (`@cf/zai-org/glm-4.7-flash`) is a reasoning
  model that spends most of `max_tokens` on hidden chain-of-thought
  before emitting visible content — this silently truncated structured
  scoring output. Fixed in `apps/api/ai/cloudflare.py`'s `chat()` payload
  by always sending `chat_template_kwargs: {"enable_thinking": false}`;
  cut a trivial test call from ~860 completion tokens to 11 with clean
  JSON output. `AIProvider.chat()`'s interface contract is unchanged —
  this is adapter-internal, invisible to every caller.
- Frontend: `apps/web/src/components/ui/{Badge,Toggle}.tsx` added to the
  shared component set. `SearchPage` runs the client-orchestrated scoring
  loop (sequential, one call per queued ID) with a "Scoring N of M…"
  readout; per-run failures are force-merged into the visible list (via
  the single-posting fetch) so a failure is never silently hidden by the
  default threshold filter. `PostingsList` gained the score Badge,
  expandable reasoning panel, "Show below-threshold" Toggle, and inline
  "Retry scoring" on failed cards.
- Verified end-to-end against the live Career Agent Supabase project and
  real Cloudflare credentials: resume-only profile isolation (a
  `note`-type marker chunk confirmed excluded), one real posting scored
  with structured reasoning, a forced bad-credential failure isolated to
  one posting (sibling unaffected) with a successful retry after
  restoring credentials, and `min_score` / `include_unscored` filtering
  confirmed on real rows.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/05-scoring.md` in full, along with `docs/PRD.md`
> (Agent 2's description), `docs/DATA_MODEL.md` for the `job_postings`
> scoring columns, `docs/modules/03-ai-provider.md` for the adapter and
> failure-handling conventions to reuse, and `docs/modules/04-job-
> connectors.md` for the "New postings" view this module extends.
> Implement Module 5 exactly as specced: a scoring service using only
> `resume`-type knowledge chunks as profile context, one chat call per
> posting producing a 0–100 score plus structured reasoning, automatic
> scoring right after a search run completes, a per-posting retry path
> for failures, an editable threshold setting, and a scored-list UI
> (sort by score, below-threshold hidden with a toggle, expandable
> reasoning, visible progress feedback during scoring) built on the
> existing dashboard shell and component set — adding Badge and
> Toggle/Switch components to that shared set. Do not implement company
> research, drafting, or auto-apply approval. If any decision here seems
> wrong or you need to deviate, stop and ask me before proceeding. When
> done, walk through the acceptance criteria checklist and tell me the
> status of each item.