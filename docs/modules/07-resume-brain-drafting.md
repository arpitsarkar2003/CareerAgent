# Module 7 — Resume Brain + Application Drafting (RAG)

**Status:** Not started.
**Depends on:** Module 2 (knowledge chunks to retrieve, dashboard shell),
Module 3 (chat + embed via the adapter), Module 6 (company research to
tailor with).
**Unblocks:** Module 8 (the review queue operates on the `applications`
rows this module creates), Module 9 (the runner submits what this module
drafts).

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full prompts, retrieval code,
or migrations into this file — describe behavior in prose and tables.

---

## Goal

For a posting I actually want to proceed with, produce a tailored resume
summary/bullets, a cover letter, and answers to any custom application
questions — grounded in my real knowledge base and that company's
research, not generic filler. Save it as a real `applications` row I can
read, edit, and approve later.

Success = I click "Draft this application" on a posting I care about, and
within a short wait I have an editable draft that already sounds like it
was written by someone who read the posting and knows the company —
because it was, functionally.

---

## In scope

- A "Draft application" action, available per scored posting, that runs
  the full pipeline: fetch-or-cache-hit company research (Module 6) →
  retrieve relevant knowledge chunks (Module 2's data, via similarity
  search) → draft via chat call → save.
- Retrieval: embed the posting's `raw_text`, similarity-search against
  **all** `knowledge_chunks` source types (resume, cover letter, project,
  note) — unlike Module 5's scoring, which deliberately used resume-only
  chunks for a fast skills match, drafting benefits from project and note
  detail too. Top-k (8–12) chunks.
- A way for me to specify custom application questions per application
  (e.g. "Tell us about yourself," "Why this company?") before or during
  drafting, since these live in the target ATS, not the job posting text
  itself, and the agent has no way to know them otherwise.
- Structured drafting output: resume bullets/summary, cover letter text,
  and an answer per custom question, all parsed into `applications`
  columns per `DATA_MODEL.md`.
- Creating the `applications` row itself (`status = 'drafted'`) — this is
  the first module in the v2 rebuild where that table actually gets
  populated in the new flow.
- Setting `requires_manual_review = true` automatically whenever the
  underlying `job_postings.source = 'linkedin'` — enforced here in the
  service layer that creates the row, not left to the UI.
- An application detail view: shows the posting, the draft (editable),
  the custom Q&A (editable), and the company research (read-only,
  reused from Module 6's panel).
- A "Re-draft" action that regenerates everything, with a confirmation
  step since it overwrites any manual edits I've made.

## Out of scope

- The review/approve queue and Tracker (Module 8) — this module only
  produces drafts; deciding what to do with them is the next module.
- Actual submission (Module 9).
- Email, follow-up, interview prep, negotiation (later modules).

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Agent 2b (Resume Brain) description, Flow 4 |
| `docs/DATA_MODEL.md` | `applications` columns, incl. `custom_answers`, `requires_manual_review` |
| `docs/modules/02-knowledge-base.md` | `knowledge_chunks` shape, dashboard shell, components |
| `docs/modules/03-ai-provider.md` | Chat + embed capabilities to use |
| `docs/modules/06-company-research.md` | Research this module consumes, and its "unavailable" fallback behavior |

---

## Decisions (locked for Module 7)

### Retrieval scope
- Embedding-similarity retrieval against knowledge chunks uses **all**
  source types for drafting — deliberately broader than Module 5's
  resume-only scoring context, since a specific project's stack/outcome
  or a note-sized achievement is exactly the kind of detail that makes a
  cover letter or custom answer sound specific instead of generic.

### Custom questions
- Stored as a simple list of question strings attached to the
  application, entered by me before or at draft time (implementer's
  choice on exact UI flow — a small add/remove list is enough, no need
  for anything fancier). The draft call answers each one, and answers are
  persisted as question/answer pairs in `custom_answers`.

### Application creation timing
- An `applications` row is created only when I explicitly choose to draft
  a specific posting — not automatically for every scored posting. This
  keeps the table meaningful: a row here means a posting I decided to
  actually pursue, matching the original product flow.

### Re-draft behavior
- Re-drafting always regenerates and overwrites the resume draft, cover
  letter, and all custom answers in one pass — no partial/selective
  regeneration in this version. Because this is destructive to any manual
  edits I've made, it requires an explicit confirmation step before
  running.

### Failure handling
- If company research was unavailable (per Module 6's fallback), drafting
  still proceeds using knowledge chunks and posting text alone, with a
  visible note on the resulting draft that company-specific tailoring was
  limited. Drafting is never fully blocked by a research failure.
- If the drafting chat call itself fails after retries, no partial/
  garbled `applications` row is created — the action fails clearly and
  can be retried, following Module 3's typed failure pattern.

---

## UX

Builds on Modules 2, 5, and 6's existing patterns — no new visual
language.

### Triggering a draft
- "Draft this application" action on a scored posting card.
- **Multi-stage progress feedback** while the pipeline runs (this
  involves several sequential calls — research, retrieval, drafting — and
  can take real seconds): short, honest stage labels ("Researching the
  company…", "Reviewing your experience…", "Writing your draft…") rather
  than one generic spinner. Same philosophy as Module 5's scoring
  progress indicator.

### Application detail view
- Sections for resume draft, cover letter, and custom Q&A, each editable
  inline (reusing Module 2's Input/Textarea patterns) with an explicit
  Save — no silent auto-overwrite from background AI activity.
- Company research shown as a collapsed, reused panel from Module 6 —
  read-only reference alongside the draft, not duplicated content.
- A status Badge (`drafted`), reusing Module 5's Badge component.
- "Re-draft" as a clearly separated, confirmation-gated action (reusing
  Module 2's Modal) — distinct from the Save button so the two are never
  confused.
- Custom-question list: simple add/remove entries before drafting;
  answered ones display question above its drafted answer, both editable.

No new base components required — this module composes Input, Textarea,
Card, Badge, and Modal, all already in the shared set.

---

## API conventions

Follows Module 2's conventions. Drafting is one service function
(research → retrieve → draft → persist) callable from both the "new
draft" and "re-draft" entry points, not duplicated logic between them.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Retrieval service | Embed posting text, similarity search across all chunk types |
| Drafting service | Research + retrieved chunks + posting → structured draft via chat call |
| Custom question input | Simple list, attached to the application |
| `applications` row creation | `status = 'drafted'`, `requires_manual_review` set correctly |
| Re-draft action | Confirmation-gated, full overwrite |
| Application detail view | Editable draft, custom Q&A, research panel, status badge |
| Multi-stage progress UI | Reused pattern from Module 5 |

---

## Acceptance criteria

- [ ] Drafting a posting produces a resume draft, cover letter, and an
  answer for every custom question I added, saved to a new
  `applications` row with `status = 'drafted'`.
- [ ] A posting from a LinkedIn source always produces an application
  with `requires_manual_review = true`, with no way to bypass this from
  the UI.
- [ ] Retrieval pulls from all knowledge-chunk source types, not just
  resume chunks (confirm a project- or note-only detail shows up in a
  draft where relevant).
- [ ] If company research is unavailable, drafting still completes, with
  a visible note that tailoring was limited.
- [ ] Editing the draft or custom answers and saving persists the edits;
  they are not silently overwritten by anything except an explicit
  "Re-draft."
- [ ] "Re-draft" requires confirmation before overwriting existing
  content.
- [ ] A forced drafting failure doesn't leave a half-populated
  `applications` row.
- [ ] No review-queue, auto-apply, or submission logic is present.

---

## How an implementer should work

1. Read this file, `DATA_MODEL.md`'s `applications` section, Module 3's
   adapter contract, and Module 6's research fallback behavior.
2. Build the retrieval service (embed + similarity search across all
   chunk types) independent of drafting.
3. Build the drafting service: assemble research + chunks + posting +
   custom questions into one chat call, parse structured output.
4. Wire `applications` row creation, including the `requires_manual_review`
   rule.
5. Build the application detail view and the "Draft"/"Re-draft" triggers
   with progress feedback.
6. Verify acceptance criteria, including the LinkedIn-flag and
   research-unavailable cases.
7. Stop. Do not start Module 8 until its own spec exists.

## How to verify

1. Draft an application for a non-LinkedIn posting with at least one
   custom question added; confirm the resulting row has all fields
   populated sensibly and `requires_manual_review = false`.
2. Draft an application for a LinkedIn-sourced posting; confirm
   `requires_manual_review = true` regardless of any setting.
3. Edit the draft, save, refresh, confirm the edit persisted.
4. Click "Re-draft," confirm the confirmation step appears and, once
   confirmed, all fields are regenerated.
5. Temporarily force a company-research failure and confirm drafting
   still completes with the "limited tailoring" note.

---

## Open questions

| Question | Resolution |
|----------|------------|
| Exact custom-question entry flow (separate step vs. inline with drafting) | Implementer's choice |
| Top-k retrieval count (8 vs. 12) | Implementer's choice within the 8–12 range; document the chosen value |
| Selective/partial re-draft (e.g. just the cover letter) | Deferred — not required for v2 acceptance |

---

## Non-goals reminder

No review queue, auto-apply approval, or submission logic in this module
— unchanged from `PRD.md`.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/07-resume-brain-drafting.md` in full, along with
> `docs/PRD.md` (Agent 2b's description and Flow 4), `docs/DATA_MODEL.md`
> for the `applications` shape, `docs/modules/03-ai-provider.md` for the
> chat/embed capabilities to use, and `docs/modules/06-company-
> research.md` for the research this module consumes and its fallback
> behavior. Implement Module 7 exactly as specced: retrieval across all
> knowledge-chunk types (not resume-only), a drafting service producing a
> tailored resume draft, cover letter, and custom-question answers in one
> pass, `applications` row creation with `requires_manual_review` forced
> true for LinkedIn-sourced postings, a confirmation-gated re-draft
> action, and an application detail view built on the existing component
> set with multi-stage progress feedback while drafting runs. Do not
> implement review-queue, auto-apply, or submission logic. If any
> decision here seems wrong or you need to deviate, stop and ask me
> before proceeding. When done, walk through the acceptance criteria
> checklist and tell me the status of each item.
