# Module 6 — Company Research Agent

**Status:** Not started.
**Depends on:** Module 3 (AI adapter's chat capability), Module 4/5
(postings with `company` names to research exist by now).
**Unblocks:** Module 7 (Resume Brain drafts using this research to tailor
answers per company).

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full prompts, client code, or
migrations into this file — describe behavior in prose and tables.

---

## Goal

Given a company name, gather enough real, current context (funding, tech
stack, founders, recent news, culture, products, customers) that Module
7's drafting can write something specific instead of generic — and cache
it, so applying to three postings at the same company only researches
that company once.

Success = when I draft an application, the cover letter and custom
answers visibly reference something true and specific about that company
(e.g. their actual tech stack or a recent funding round), not boilerplate.

---

## In scope

- A research service in `apps/api` that takes a company name and produces
  structured research: funding, tech stack, founders, recent news,
  culture notes, products, customers.
- This requires an actual web-search capability inside `apps/api` (not
  just the chat model's training knowledge, which goes stale) — see
  Decisions below for how that's structured.
- Caching into `company_research`, keyed by company name per user, with a
  freshness window so repeat postings at the same company don't
  re-research from scratch every time.
- A manual "Refresh research" action that bypasses the cache and
  re-fetches, for when cached data is stale or wrong.
- A minimal way to see a company's research once fetched — embedded in
  context (the posting/application view), not a standalone "company
  explorer" page.

## Out of scope

- Application drafting itself (Module 7) — this module only produces and
  caches the research; Module 7 consumes it.
- The full review/approve queue (Module 8).
- Any research related to interview prep or salary negotiation data
  (Glassdoor/Levels.fyi-style sources) — those are Modules 13/14 and use
  different data even though the shape rhymes.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Agent 3 description |
| `docs/DATA_MODEL.md` | `company_research` table shape |
| `docs/modules/03-ai-provider.md` | Chat capability + typed failure pattern to reuse |
| `docs/ARCHITECTURE.md` | Provider-abstraction principle — this module extends the same philosophy to "search," not just AI |

---

## Decisions (locked for Module 6)

### Research method
- Web search + chat-model synthesis: a search call (or a small number of
  them) gathers current information about the company, then a chat call
  synthesizes it into the structured shape above. A chat call alone,
  without search, isn't acceptable — the model's training data goes
  stale and "recent news" would be neither recent nor real.
- The web-search capability lives behind its own single function in
  `apps/api`, the same way Module 3 isolated the AI provider behind one
  interface — so the specific search API used can change later without
  touching the research service that calls it.
- **Cost note**: most search APIs are not free past a small quota. Since
  the project is currently on free tiers everywhere else, pick a provider
  with a workable free tier for personal-scale usage (low request volume
  — one company lookup per new company encountered, not per posting) and
  document the choice and its limits in the PR. This is flagged as an
  open question below rather than locked, since it's a real cost decision
  and not purely technical.

### Caching and freshness
- Cache key: company name, normalized (trimmed, case-insensitive), per
  `user_id`.
- Freshness window: default 30 days. Within that window, a new posting at
  an already-researched company reuses the cached row — no new search or
  chat calls.
- "Refresh research" always bypasses the cache regardless of freshness,
  and updates `researched_at`.

### Trigger
- Research is not run automatically for every scored posting — that would
  burn search/chat calls on companies I never proceed with. It runs
  automatically as the first step of Module 7's "Draft application"
  action (research → retrieve knowledge → draft, in one flow from my
  perspective), the first time I draft for a given company, or whenever
  the cache is stale and I re-draft.

### Failure handling
- If research fails (search API down, no results, parsing failure) after
  the adapter's retry pattern, drafting in Module 7 is not blocked — it
  proceeds using knowledge-base chunks and the posting text alone, and
  the UI notes "company research unavailable" so I know the draft is less
  tailored than usual, rather than silently degrading without telling me.

---

## UX

No new page. Research surfaces contextually wherever a posting or
application is being viewed (Module 5's card, Module 7's detail view):

- A **"Company research" panel**, same expandable/collapsed pattern as
  Module 5's score reasoning — collapsed by default, so it doesn't add
  noise to postings I haven't drafted for yet.
- Shows a **"last researched: N days ago"** note and a **"Refresh"**
  action.
- **Loading state** while a fresh lookup runs (this can take several
  seconds — search plus synthesis) — reuse the existing loading pattern,
  not a bare spinner with no context.
- **Failed/unavailable state**: calm, non-blocking — "Couldn't research
  this company right now" rather than an alarming error state, since
  drafting still works without it.

No new reusable components needed — this reuses Module 2's Card/loading
patterns and Module 5's expandable-panel pattern directly.

---

## API conventions

Follows Module 2's conventions. The research fetch-or-cache-hit logic is
a single service function callable from Module 7's drafting flow and from
a standalone "refresh" endpoint — not duplicated between the two.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Search capability seam | One function, swappable provider underneath |
| Research synthesis service | Search results → structured research via chat call |
| `company_research` caching | Keyed by normalized company name + `user_id`, freshness window |
| Refresh action | Bypasses cache, updates `researched_at` |
| Contextual research panel | Embedded in posting/application views, not a standalone page |

---

## Acceptance criteria

- [ ] Requesting research for a new company produces a populated
  `company_research` row with all of funding/tech stack/founders/news/
  culture/products/customers present or explicitly marked unavailable
  per field (not silently omitted with no indication).
- [ ] Requesting research again for the same company within the freshness
  window does not trigger new search/chat calls — confirmed via logs.
- [ ] "Refresh research" always re-fetches regardless of freshness.
- [ ] A forced research failure doesn't block Module 7 drafting — drafting
  still completes, with a visible "research unavailable" note.
- [ ] The search provider choice and its free-tier limits are documented
  in the PR.
- [ ] No drafting or review-queue logic was added here.

---

## How an implementer should work

1. Read this file, `DATA_MODEL.md`'s `company_research` section, and
   Module 3's adapter/failure-handling pattern.
2. Pick a web-search provider with a workable free tier for low personal
   volume; isolate it behind one function.
3. Build the synthesis service: search results in, structured research
   out, via one chat call.
4. Wire caching with the freshness window and the normalized company-name
   key.
5. Add the refresh action.
6. Add the contextual research panel to existing posting/application
   views.
7. Verify acceptance criteria, including the cache-hit and forced-failure
   cases.
8. Stop. Do not start Module 7 until its own spec exists (they may be
   built close together, but each gets checked off separately).

## How to verify

1. Trigger research for a company, confirm a populated `company_research`
   row.
2. Trigger it again immediately, confirm (via logs) no new search/chat
   calls happened.
3. Click "Refresh," confirm new calls happen and `researched_at` updates.
4. Temporarily break the search provider's credentials and confirm
   drafting elsewhere still isn't blocked, with the "unavailable" note
   shown.

---

## Open questions

| Question | Resolution |
|----------|------------|
| Which web-search API/provider | Implementer's choice — pick one with a usable free tier at personal scale, document the choice and limits in the PR |
| Freshness window default (30 days) | Adjustable later if it proves too short/long in practice |
| Per-field partial failure (e.g. funding found, news not) | Store what's found, mark missing fields explicitly rather than omitting them silently |

---

## Non-goals reminder

No drafting, review queue, interview prep, or negotiation research in
this module — unchanged from `PRD.md`.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/06-company-research.md` in full, along with
> `docs/PRD.md` (Agent 3's description), `docs/DATA_MODEL.md` for the
> `company_research` shape, and `docs/modules/03-ai-provider.md` for the
> adapter and failure-handling conventions to reuse. Implement Module 6
> exactly as specced: a swappable web-search seam, a synthesis service
> that turns search results into structured company research via one
> chat call, caching keyed by normalized company name with a 30-day
> freshness window, a manual refresh action, and a contextual (not
> standalone) research panel reusing existing UI patterns. Pick a
> search provider with a workable free tier for low personal-scale
> volume and document your choice and its limits in your summary. Do not
> implement drafting or review-queue logic. If any decision here seems
> wrong or you need to deviate, stop and ask me before proceeding. When
> done, walk through the acceptance criteria checklist and tell me the
> status of each item.
