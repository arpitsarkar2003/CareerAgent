# Module 8 — Review Queue + Tracker Dashboard

**Status:** Not started.
**Depends on:** Module 7 (drafted `applications` rows to review), Module
5 (score data shown alongside), Module 2 (dashboard shell, components).
**Unblocks:** Module 9 (the runner processes tasks this module creates
when I approve auto-apply).

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full component code or
migrations into this file — describe behavior in prose and tables.

---

## Goal

Give the drafted applications a real home: a **Review queue** where I
decide, per drafted application, whether to approve it for auto-apply or
handle it manually — and a **Tracker** showing every application across
its full lifecycle. These map directly onto the "Applications" and
"Tracker" items already sitting in the sidebar since Module 2.

Success = I can look at everything I've drafted, make a fast approve/
manual decision per one, and separately see my whole pipeline's status at
a glance without losing track of anything.

---

## In scope

- **Review queue** ("Applications" in the sidebar): lists applications
  with `status = 'drafted'`. Per application: score (from the linked
  posting), company/title, an "Approve for auto-apply" action, and a
  "Mark as applied manually" action.
- **Approve for auto-apply** creates a `runner_tasks` row
  (`task_type = 'apply'`, `status = 'pending'`) — this row *is* the
  approval record; no separate approval flag is needed. Module 9's runner
  will later pick these up; until Module 9 ships, approved ones simply
  sit visibly pending.
- This action is **never available** for an application whose posting
  has `source = 'linkedin'` — not just hidden in the UI, but rejected
  server-side if attempted directly, matching the locked non-goal.
- **Mark as applied manually**: sets `status = 'applied'`,
  `applied_at = now()`, no runner task involved. Available for every
  source, including LinkedIn.
- **Tracker** (separate sidebar item): a filterable list of every
  application across the full status pipeline (`drafted → applied → oa →
  technical → hr → interview → offer / rejected`), with a way to change
  status manually and edit notes.
- Finally addressing the `applications.updated_at` trigger flagged since
  Module 1 — this module is the first one that actually mutates status
  repeatedly, making a stale `updated_at` a real problem rather than a
  theoretical one.

## Out of scope

- The CareerOS Runner itself, Playwright, or the native "Start"
  notification flow — this module only creates the `runner_tasks` row;
  Module 9 is what consumes it.
- Drafting/re-drafting content (Module 7 owns that; this module links to
  it, doesn't duplicate it).
- Email, follow-up, interview prep, negotiation (later modules).
- Drag-and-drop kanban — a filterable table/list with a status-change
  control per row is sufficient and simpler to build responsively; a
  drag-and-drop board is explicitly not planned.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/PRD.md` | Flow 3, Flow 5, Flow 6; the hard-coded LinkedIn non-goal |
| `docs/DATA_MODEL.md` | `applications` status enum, `runner_tasks` shape |
| `docs/modules/07-resume-brain-drafting.md` | Where the `applications` rows this module lists come from |
| `docs/modules/05-scoring.md` | Score/Badge pattern reused here |
| `docs/ARCHITECTURE.md` | Why the runner queue is the approval mechanism (decision #5/#6) |

---

## Decisions (locked for Module 8)

### Approval mechanism
- "Approve for auto-apply" writes a `runner_tasks` row directly. There is
  no separate "approved" boolean on `applications` — the existence of a
  pending/in-progress task is the approval state. This avoids a second
  source of truth that could drift from the actual task queue.

### LinkedIn enforcement (defense in depth)
- The UI never renders an enabled "Approve for auto-apply" control for a
  LinkedIn-sourced application (shown disabled with an explanatory note
  instead of hidden entirely, so it's clear this isn't a bug).
- The API route that creates `runner_tasks` rows independently checks the
  linked posting's `source` and rejects the request if it's `linkedin`,
  regardless of what the client sends — the UI restriction is not the
  only enforcement.

### Two views, two purposes
- **Review queue** = decision-making surface, scoped to `status =
  'drafted'` only. Once an application leaves `drafted` (applied, or
  further), it drops out of this view and only lives in the Tracker.
- **Tracker** = the full lifecycle view across every status, with
  filtering (by status, company, or date) and a status-change control
  plus editable notes per row.

### Status changes and `updated_at`
- Any status change (from either view, or later automated ones) updates
  `applications.updated_at`. If a real database trigger still isn't in
  place, the API service layer must set it explicitly on every write —
  either way, this module is the line after which a stale `updated_at`
  is no longer acceptable.

### Layout choice
- Table/list view, not a kanban board. Status shown as a compact badge/
  stepper per row rather than a draggable card in a column — simpler to
  build responsively and enough for single-user use. A kanban view is
  explicitly not planned; don't build toward one "just in case."

---

## UX

Builds entirely on components already in the shared set — no new base
components needed.

### Review queue ("Applications")
- Card or row per drafted application: score Badge (reused from Module
  5), company/title, a compact primary action area with "Approve for
  auto-apply" and "Mark as applied manually" as clearly distinct actions
  (different visual weight — auto-apply is the more consequential one,
  so it should feel slightly more deliberate, e.g. behind a confirmation
  Modal explaining what happens next: "This queues the job for your
  local runner — you'll still need to click Start there.").
- Disabled auto-apply control for LinkedIn items shows a short inline
  explanation, not just a grey button with no context.
- Link through to the full draft (Module 7's detail view) from each row.
- Empty state: "Nothing waiting for review — draft an application from
  a scored posting to see it here."

### Tracker
- Filterable list/table: filter tabs or a dropdown for status, plus a
  search/filter by company.
- Per-row status-change control (a select/dropdown through the locked
  pipeline order) and an editable notes field.
- Reuses the same score Badge and Card patterns for visual consistency
  with the Review queue rather than introducing a denser "spreadsheet"
  look.

---

## API conventions

Follows Module 2's conventions. Status-change and runner-task-creation
are each one service function, callable from the relevant route, with the
LinkedIn check enforced inside the service layer (not just the route),
so no future caller can accidentally skip it.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Review queue view | `status = 'drafted'` list with approve/manual actions |
| Auto-apply approval | Creates `runner_tasks` row, blocked server-side for LinkedIn |
| Manual-applied action | Status + `applied_at` update, no runner involvement |
| Tracker view | Full pipeline, filterable, status-change + notes per row |
| `updated_at` handling | Trigger or explicit service-layer set, finally resolved |

---

## Acceptance criteria

- [ ] Drafted applications appear in the Review queue with correct score
  and posting info.
- [ ] Approving a non-LinkedIn application creates a `runner_tasks` row
  with `status = 'pending'`.
- [ ] Attempting to approve a LinkedIn-sourced application is blocked
  both in the UI (control disabled with explanation) and via a direct
  API call (rejected, not silently ignored).
- [ ] "Mark as applied manually" works for every source, including
  LinkedIn, and requires no runner task.
- [ ] The Tracker shows every application regardless of status, supports
  filtering, and status changes persist correctly.
- [ ] Any status change updates `applications.updated_at` — verified with
  a direct check, not assumed.
- [ ] No kanban/drag-and-drop UI, runner execution, or drafting logic was
  added here.

---

## How an implementer should work

1. Read this file, `DATA_MODEL.md`'s `applications`/`runner_tasks`
   sections, and `PRD.md`'s Flow 3/5/6.
2. Resolve the `updated_at` trigger question first — either add the
   database trigger or confirm the service layer sets it explicitly on
   every write.
3. Build the Review queue view and its two actions, including the
   server-side LinkedIn check.
4. Build the Tracker view: filtering, status-change control, notes.
5. Verify acceptance criteria, especially the LinkedIn bypass-attempt
   case via a direct API call, not just the UI.
6. Stop. Do not start Module 9 until its own spec exists.

## How to verify

1. Draft a non-LinkedIn application, approve it for auto-apply, confirm a
   `runner_tasks` row appears with `status = 'pending'`.
2. Draft a LinkedIn-sourced application, confirm the UI won't let you
   approve it, then attempt the same action via a direct HTTP call and
   confirm the API rejects it too.
3. Mark an application as applied manually, confirm status and
   `applied_at` update with no `runner_tasks` row created.
4. Change an application's status in the Tracker, confirm `updated_at`
   changes.
5. Filter the Tracker by a specific status and confirm only matching rows
   show.

---

## Open questions

| Question | Resolution |
|----------|------------|
| Exact status-change UI (dropdown vs. buttons) | Implementer's choice |
| Tracker default sort | Implementer's choice; most-recently-updated first is a reasonable default |
| Notes field: freeform text vs. structured | Freeform, per `DATA_MODEL.md` |

---

## Non-goals reminder

No runner execution, Playwright, notifications, drafting, or kanban board
in this module — unchanged from `PRD.md` and `ARCHITECTURE.md`.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/08-review-tracker.md` in full, along with
> `docs/PRD.md` (Flows 3, 5, and 6, and the hard-coded LinkedIn
> non-goal), `docs/DATA_MODEL.md` for the `applications` and
> `runner_tasks` shapes, `docs/modules/07-resume-brain-drafting.md` for
> where drafted applications come from, and `docs/ARCHITECTURE.md` for
> why the runner task queue itself is the approval mechanism. Implement
> Module 8 exactly as specced: a Review queue scoped to drafted
> applications with "Approve for auto-apply" (creating a `runner_tasks`
> row, blocked both in the UI and server-side for LinkedIn-sourced
> applications) and "Mark as applied manually" actions, and a separate
> Tracker view across the full status pipeline with filtering, a
> status-change control, and notes — as a filterable table/list, not a
> kanban board. Also resolve the `applications.updated_at` staleness
> flagged since Module 1, either via a real trigger or an explicit
> service-layer set on every write. Do not implement the runner itself,
> drafting logic, or a kanban UI. If any decision here seems wrong or you
> need to deviate, stop and ask me before proceeding. When done, walk
> through the acceptance criteria checklist and tell me the status of
> each item.
