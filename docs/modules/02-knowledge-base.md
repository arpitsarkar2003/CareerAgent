# Module 2 — Knowledge Base Ingestion + Dashboard Shell

**Status:** Not started.
**Depends on:** Module 1 (scaffold, schema, Clerk shell).
**Unblocks:** Every later dashboard module (2b onward) inherits the UI
shell and API conventions locked here — this is the module that turns the
thin Clerk stub into an actual product surface.

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full component code, API
handlers, or migrations into this file — describe them in prose and
tables.

---

## Goal

Ship the first real feature end to end:

1. I can upload or paste a resume, cover letters, and project/achievement
   notes.
2. Each source gets chunked, embedded, and stored in `knowledge_chunks`.
3. I can view, edit, and delete individual chunks in a dashboard UI.
4. That dashboard UI is built on a real shell — sidebar navigation,
   responsive layout, a small reusable component set — that every future
   module (search results, applications, tracker, etc.) will plug into
   rather than each inventing its own layout.
5. The API conventions established here (route shape, validation, response
   format, pagination, error format) are the pattern every later router
   follows, not something each module re-decides.

Success = I can build my knowledge base through the UI and see it
reflected correctly in Supabase, inside a dashboard shell that already
looks and feels like a real product, not a stub page.

---

## In scope

- Upload/paste flow for three source types: resume, cover letter, project/
  achievement notes. Support both pasting raw text and uploading a file
  (PDF/DOCX/plain text) for resume and cover letters at minimum.
- Chunking strategy (see Decisions) implemented server-side in `apps/api`.
- A minimal embedding call — just enough to embed a chunk of text and get
  a vector back — used by this module. This is intentionally narrow; the
  full provider-agnostic adapter interface (chat + embed, provider
  switching) is Module 3's job. Module 2 should isolate this call behind a
  single function so Module 3 can slot in underneath it without Module 2's
  code changing.
- Storage into `knowledge_chunks` exactly as defined in `DATA_MODEL.md`.
- A "Knowledge Base" dashboard page: list of sources, list of chunks per
  source, edit chunk text inline, delete a chunk, delete an entire source
  (cascading its chunks).
- The dashboard shell itself: persistent sidebar navigation, responsive
  behavior, and a small reusable component library — see UX section below.
- Per-request Clerk session verification in `apps/api` for every route this
  module adds (Module 1 only wired Clerk env vars; this is the first
  module where the API actually checks a session on real data routes).
- API conventions for this and all future routers — see API Conventions
  section below.

## Out of scope

- Job search, scoring, company research, application drafting (Modules
  4–7).
- The full AI provider adapter with provider switching (Module 3) — Module
  2 only needs a working embed call, not the abstraction layer around it.
- Any browser automation, email, follow-up, interview prep, negotiation
  (later modules).
- Redesigning the Tectonic landing page — the dashboard shell is new
  surface area, not a landing page change.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Product goals, agent list, non-goals |
| `docs/ARCHITECTURE.md` | Two-service split, secrets split, runner boundary |
| `docs/DATA_MODEL.md` | `knowledge_chunks` columns |
| `docs/ROADMAP.md` | Module order |
| `docs/modules/01-scaffold-supabase.md` | What Module 1 already shipped |
| Existing Tectonic landing page (live) | Source of theme tokens — colors, type scale, spacing — do not invent a new palette |

---

## Decisions (locked for Module 2)

### Chunking strategy
- Chunk per logical unit, not fixed character count: resume → one chunk
  per role/experience entry plus one chunk per distinct skills/summary
  block; cover letters → one chunk per paragraph; notes → one chunk per
  note (or per heading if a note has internal sections).
- Target chunk length: roughly 100–300 words. If a logical unit is much
  longer, split further along paragraph boundaries rather than mid-
  sentence truncation.
- Each chunk's `metadata` column captures at minimum: role/company/dates
  for resume chunks, and a free-form `skills` array where extractable.
- Re-uploading a source replaces its previous chunks rather than
  appending duplicates (delete-then-insert per source, in one
  transaction).

### Embedding call boundary
- A single function (not a full adapter class) in `apps/api/ai/` takes
  text, returns a vector, and hard-codes OpenRouter's embedding endpoint
  for now. Module 3 will replace its internals with the full
  provider-agnostic adapter — routers and chunking code that call this
  function should not need to change when that happens.

### Per-request auth
- Every route this module adds requires a valid Clerk session; the API
  verifies the session server-side and derives `user_id` from it — never
  trusts a `user_id` passed in the request body.

### File handling
- Uploaded files are parsed to plain text server-side (PDF/DOCX/plain
  text) and never stored as raw binary blobs in Supabase — only the
  extracted, chunked text is persisted. Original files are discarded
  after parsing.

---

## UX / dashboard shell

This is the first module with a real dashboard UI, so it sets the shape
everything else builds on.

### Layout
- **Persistent sidebar** on desktop: fixed-width, holds top-level nav
  (Knowledge Base now; Search, Applications, Tracker, Email, Interview
  Prep, Negotiation as later modules land — build the nav so adding an
  item is trivial, don't hardcode assumptions about the final item count).
- **Responsive behavior**: sidebar collapses to an icon rail or a
  hamburger-triggered drawer below a tablet-width breakpoint; content area
  reflows to full width. Test at three widths at minimum: mobile (~375px),
  tablet (~768px), desktop (~1280px+).
- **Top bar**: minimal — page title/breadcrumb, account/sign-out (Clerk's
  user button is fine as-is).

### Theme
- Reuse the existing Tectonic landing page's design tokens — colors, font
  stack, spacing scale, border radii — rather than introducing a second
  visual language. If the landing page's tokens aren't already extracted
  into shared variables/config, that extraction is part of this module's
  work, not a new design.
- Dark/light mode: match whatever the landing page already does; don't
  add a mode toggle unless the landing page already has one.

### Reusable components
Build a small shared component set under a common location in `apps/web`,
used by this module and intended for reuse by every later one — not
page-specific one-offs:
- Page shell / sidebar layout wrapper
- Card / panel
- Button (primary/secondary/destructive variants)
- Text input + textarea
- Modal / dialog (for delete confirmations)
- Empty state (for "no sources yet")
- Loading state (skeleton or spinner, used consistently)
- Toast/inline notification for success/error feedback after save/delete

Later modules should be extending this set, not creating parallel ad hoc
components for the same purposes (e.g. Applications and Tracker should
reuse the same Card and Button, not define their own).

---

## API conventions (established here, followed by all future routers)

- **Route shape**: resource-oriented, versioned prefix (e.g. all routes
  under a common `/api/v1/...` style base), nouns not verbs — knowledge
  sources and chunks as resources with standard list/create/update/delete
  semantics.
- **Response envelope**: a consistent shape for every response — a
  top-level success/data field and a top-level error field, so the web
  client has one parsing path for every endpoint rather than a different
  shape per router.
- **Validation**: request and response schemas defined once per route
  using the API framework's schema layer (Pydantic), not hand-rolled
  dict checks in handler bodies.
- **Error format**: errors return a machine-readable code plus a
  human-readable message, with HTTP status matching the error class
  (400 validation, 401 auth, 404 missing, 409 conflict, 500 unexpected) —
  never a 200 with an error buried in the body.
- **Pagination**: any list endpoint (chunk list, later job list,
  applications list) takes a page-size + cursor (or offset) pair from the
  start, even if the knowledge base is small today — retrofitting
  pagination later touches every caller.
- **Service layer separation**: route handlers stay thin — parse/validate
  request, call a service function (chunking, embedding, storage), shape
  the response. Business logic (chunking rules, replace-on-reupload
  semantics) lives in service functions under `apps/api`, not inline in
  route handlers, so later modules (and tests) can call the same services
  directly.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Upload/paste UI | Resume, cover letter, notes — file upload + paste-text path |
| Chunking service | Per-source-type chunking logic in `apps/api` |
| Embedding function | Narrow, swappable, isolated from routers |
| Storage logic | Replace-on-reupload, transactional per source |
| Knowledge Base dashboard page | List sources, list/edit/delete chunks |
| Dashboard shell | Sidebar, responsive layout, top bar |
| Reusable component set | Card, Button, Input, Modal, Empty/Loading states, Toast |
| Per-request Clerk verification | Applied to every route this module adds |
| API convention baseline | Route shape, envelope, validation, pagination, service-layer split — documented in this file for future modules to follow |

---

## Acceptance criteria

- [ ] I can paste or upload a resume, cover letter, and a note, and each
  produces sensible chunks in `knowledge_chunks` with correct
  `source_type` and non-empty `metadata` where extractable.
- [ ] Re-uploading a source replaces its old chunks rather than
  duplicating them.
- [ ] I can view all chunks for a source, edit a chunk's text and have it
  persist, and delete a chunk or an entire source.
- [ ] The dashboard shell renders correctly at mobile/tablet/desktop
  widths, with the sidebar collapsing appropriately below tablet width.
- [ ] The dashboard visually matches the existing Tectonic theme (colors,
  type, spacing) rather than looking like a separate app.
- [ ] Every new API route rejects requests without a valid Clerk session.
- [ ] List endpoints support pagination even though the dataset is small
  today.
- [ ] No Module 3+ features (provider switching, scoring, connectors)
  slipped in.

---

## How an implementer should work

1. Read this file, `DATA_MODEL.md`, `ARCHITECTURE.md`, and Module 1's spec.
2. Extract the Tectonic landing page's theme tokens into shared
   config/variables if not already isolated.
3. Build the dashboard shell (sidebar, responsive layout, reusable
   components) before wiring the knowledge-base feature into it.
4. Implement the chunking + embedding + storage services in `apps/api`,
   behind the API conventions above.
5. Build the upload/paste UI and chunk list/edit/delete UI against those
   endpoints.
6. Verify the acceptance checklist, including at all three breakpoints.
7. Stop. Do not start Module 3 until its own spec exists.

## How to verify

1. Upload a real resume file and confirm chunks appear in Supabase Table
   Editor with sensible `source_type`, `content`, and `metadata`.
2. Re-upload the same resume and confirm chunk count doesn't double.
3. Edit a chunk in the UI, refresh, confirm the edit persisted.
4. Delete a chunk and a whole source, confirm both are gone.
5. Resize the browser (or use device emulation) through mobile/tablet/
   desktop and confirm the sidebar behaves correctly at each.
6. Hit a knowledge-base API route with no Clerk session (e.g. via a
   plain HTTP client) and confirm it's rejected, not served.

---

## Open questions

| Question | Resolution |
|----------|------------|
| PDF/DOCX parsing library | Implementer's choice; document whichever is used in the PR |
| Exact sidebar nav items beyond Knowledge Base | Add as stubs/disabled for not-yet-built modules, or omit until built — implementer's call, just don't hardcode a final fixed list that's awkward to extend |
| Dark/light mode toggle | Only if the landing page already has one |

---

## Non-goals reminder

No job search, scoring, connectors, browser automation, or email in this
module — unchanged from `PRD.md`.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/02-knowledge-base.md` in full, along with
> `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_MODEL.md` for
> context. Implement Module 2 exactly as specced: the knowledge-base
> upload/chunk/embed/storage flow, the Knowledge Base dashboard page, and
> the dashboard shell (sidebar, responsive layout, reusable component set)
> that later modules will build on. Reuse the existing Tectonic landing
> page's theme tokens rather than inventing new colors or type. Follow the
> API conventions section exactly (route shape, response envelope,
> validation, pagination, service-layer separation) since every later
> module's API will follow the same pattern. Do not implement anything
> listed under "Out of scope." If any decision in this spec seems wrong or
> you need to deviate, stop and ask me before proceeding rather than
> guessing. When done, walk through the acceptance criteria checklist and
> tell me the status of each item.
