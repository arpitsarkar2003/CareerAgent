# Enhancement — Knowledge ingest: PDF extract + chunk quality

**Status:** Planned (not started).  
**Parent:** Module 2 knowledge base ([`docs/modules/02-knowledge-base.md`](../02-knowledge-base.md)).  
**Folder:** `docs/modules/enhancements-docs/` — post-module quality upgrades that unblocked product work can wait on, but later RAG (Modules 5–7) needs.

This is a build contract for an implementer. Prefer precise contracts over full solution code.

---

## Goal

Make uploaded resume/cover-letter PDFs produce **usable knowledge chunks**: roughly one logical unit per role / skills / summary block (about 100–300 words), with sensible metadata — not one-word or stopword fragments that poison similarity search and drafting.

Success = re-uploading the same multi-column resume PDF yields a small set of coherent chunks (e.g. summary, each job, skills, education), with no rows that are only `the` / `and` / `Git`, and metadata that looks like real roles/companies when present.

---

## Problem (observed)

After uploading a multi-column resume PDF (“Arpit Sarkar Resume”), Supabase / Knowledge UI showed dozens of tiny chunks:

- Single tokens: `Git`, `the`, `and`, `app`, `webhook`, …
- Broken mid-phrase scraps: `optimization. • Built Razorpay checkout`, `route-level`, …
- Junk metadata: `{"role": "Git", "skills": []}`, `{"role": "the", "skills": []}`

That is **not fine** for Module 5 scoring / Module 7 drafting. Module 2 shipped with a note that PDF hard-wrap reflow + tiny-fragment coalesce was “good enough for Module 2; refine later.” This enhancement is that refine.

---

## Root causes

| Layer | What’s wrong |
|-------|----------------|
| PDF parse (`pypdf`) | Multi-column / designed resumes scramble reading order; often one visual line (or word) per newline. |
| Normalize / reflow (`chunking._reflow_broken_lines`) | Helps classic hard-wrap prose; fails when every “line” is already a 1–3 word token soup. |
| Coalesce (`_coalesce_tiny`, `TINY_FRAGMENT_WORDS = 12`) | Still leaves many fragments if sections differ or fragments sit above the threshold after bad splits. |
| Role metadata (`_extract_role_meta`) | First line → `role`, so garbage first lines become `role: "Git"`. |

DOCX and pasted plain text usually fare better; PDF layout is the main failure mode.

---

## In scope

1. **Better PDF → text** for resumes/cover letters (layout-aware or stronger extractor).
2. **Stricter chunk quality gates**: minimum size, drop stopword-only / junk chunks, stronger coalesce across fragments.
3. **Safer metadata**: don’t invent `role`/`company` from garbage first lines; prefer section headers / date+title heuristics.
4. **Regression fixtures**: at least one real multi-column resume PDF (or redacted fixture) with expected chunk count / min length assertions.
5. **Re-ingest path**: document that users must **re-upload** (or delete + upload) existing bad sources — replace-on-reupload already exists; no migration of old junk vectors required beyond that.

## Out of scope

- OCR for scanned image-only PDFs (call out as follow-up if needed).
- Changing embedding model or dimension.
- New Knowledge UI redesign (small UX hint like “Prefer DOCX/paste for best quality” is OK).
- Module 4+ product features (connectors, scoring, drafting).
- Storing original PDF blobs in Supabase (still extract → discard bytes).

---

## Locked decisions (for this enhancement)

### Parser choice
- Replace or supplement `pypdf` with a layout-friendlier library for PDF:
  - **Primary recommendation:** **PyMuPDF (`fitz`)** — usually better reading order on designed resumes; keep `python-docx` for DOCX.
  - Fallback: if PyMuPDF is rejected for licensing/size, evaluate `pdfplumber` next.
- Keep a single `parse_file_bytes` entrypoint; callers (`knowledge.py`) stay unchanged.

### Chunk quality gates (apply after logical chunking)
- **Min words per chunk** (suggested default **40**, env-tunable later if needed): below threshold → merge into previous same-section chunk, else drop if still tiny and content is stopword/junk.
- **Drop junk chunks**: content matching only stopwords / punctuation / length &lt; N characters after strip.
- Raise coalesce aggressiveness for resume PDF-derived text (e.g. treat &lt; ~40 words as mergeable within section).

### Metadata hygiene
- Only set `role` / `company` when a line matches existing role heuristics **and** the candidate line has enough substance (e.g. ≥ 3 words or matches `Title at Company` / date-adjacent patterns).
- Never set `role` to a single common stopword or known skill token alone without company/dates context.

### UX / ops
- Optional one-line helper under Knowledge upload: PDF works best as single-column text-heavy; DOCX/paste recommended for designed resumes.
- After shipping, operator re-uploads existing resume sources once.

---

## Proposed phases

### Phase A — Quality gates (fast, high leverage)
**Files:** [`apps/api/services/chunking.py`](../../../apps/api/services/chunking.py)

- Raise / generalize coalesce threshold for resumes.
- Add post-pass: merge or drop sub-min-length and stopword-only chunks.
- Harden `_extract_role_meta` so 1-word first lines don’t become roles.
- Add unit tests with synthetic “word soup” and good paragraph fixtures.

**Exit:** Even with mediocre PDF text, chunk list has no 1-word rows; count drops dramatically.

### Phase B — Better PDF extraction
**Files:** [`apps/api/services/parse.py`](../../../apps/api/services/parse.py), [`apps/api/requirements.txt`](../../../apps/api/requirements.txt)

- Add PyMuPDF (or chosen lib); implement `_parse_pdf` via it.
- Prefer “text in reading order” / block extract over naive page `extract_text` if the API supports it.
- Keep size limit (8 MiB) and empty-text error behavior.
- Add fixture test: known resume PDF → extracted text has multi-word lines and recognizable section headers.

**Exit:** Same resume PDF, before chunking, looks like readable paragraphs/bullets, not token-per-line soup.

### Phase C — Resume-specific polish (if still needed after A+B)
**Files:** `chunking.py`

- Improve section/role splitting for bullet-heavy experience blocks.
- Optional: detect two-column leftovers (repeated short lines) and force paragraph reflow mode.
- Tune metadata `skills` extraction so skills sections stay one coherent chunk (or a small set), not per-token.

**Exit:** Typical resume → on the order of ~5–20 chunks, each usable for retrieval.

### Phase D — Docs + verify
- Update Module 2 shipped notes / this file status to Done.
- Document re-upload requirement.
- Manual verify on the real resume PDF used in the bug report.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| PDF parser upgrade | PyMuPDF (preferred) behind existing `parse_file_bytes` |
| Chunk quality gates | Min length, junk drop, stronger coalesce |
| Metadata hygiene | No stopword/`skill`-only roles |
| Tests + fixture | Synthetic + at least one PDF fixture (redacted OK) |
| Docs | This plan marked Done; Module 2 note updated |
| Optional UI hint | Prefer DOCX/paste for designed PDFs |

---

## Acceptance criteria

- [ ] Re-uploading the previously failing multi-column resume PDF produces **no** chunks that are a single stopword or &lt; ~3 non-trivial tokens.
- [ ] Median chunk length is in a useful band (roughly tens to low hundreds of words), not 1–5 words.
- [ ] Experience chunks (when headers/dates parse) carry plausible `role`/`company`/`dates` when present — not `role: "the"`.
- [ ] DOCX and paste-text paths still work; no regression on cover letters / notes / projects.
- [ ] Module 2 replace-on-reupload still replaces old junk chunks in one transaction.
- [ ] Automated tests cover: (1) word-soup input → coalesced/dropped; (2) clean resume text → logical role chunks; (3) PDF fixture extract is non-empty and multi-word.
- [ ] No change to embedding dims / AI provider / schema.

---

## How an implementer should work

1. Read this file and Module 2 chunking/parse decisions.
2. Ship **Phase A** first (gates) — immediate relief even before parser swap.
3. Ship **Phase B** (PyMuPDF) and re-test the real resume.
4. Only then **Phase C** if chunk structure is still wrong.
5. Re-upload production knowledge sources; confirm UI/Supabase.
6. Mark this doc **Status: Done** and update Module 2 shipped notes.

## How to verify

1. Upload the same PDF that produced junk rows; inspect Knowledge detail + Supabase `knowledge_chunks`.
2. Upload the same content as paste/DOCX; confirm quality stays good or better.
3. Delete one source and re-upload; confirm no duplicate pile-up.
4. Run unit/fixture tests in CI or locally.

---

## Risks / notes

- **PyMuPDF license:** AGPL for the library; for a personal Career Agent this is usually fine — confirm before shipping if the product ever becomes distributed SaaS.
- **Estimates ≠ perfect layout:** some designer PDFs will still need DOCX/paste; UI hint covers that.
- **Neuron budget:** re-embedding a cleaned resume is cheap vs chat; still goes through Module 3 adapter + daily budget.

---

## Open questions

| Question | Proposed default |
|----------|------------------|
| PyMuPDF vs pdfplumber | Prefer PyMuPDF; fall back if license/size blocks |
| Exact min words (40 vs 50 vs 80) | Start at **40**; tune after real resume re-upload |
| OCR for scans | Deferred |
| Persist original PDF | No — out of scope |

---

## Non-goals reminder

This enhancement only improves **ingest quality** for the knowledge base. It does not add chat UI, scoring, or connectors.

---

## Copy-paste prompt for an AI implementer

> Read `docs/modules/enhancements-docs/01-knowledge-pdf-chunk-quality.md` and Module 2’s chunking/parse notes. Implement the enhancement in phases: (A) chunk quality gates + metadata hygiene in `chunking.py`, (B) upgrade PDF parsing (prefer PyMuPDF) in `parse.py`, (C) resume polish only if needed, (D) tests + docs. Do not change embedding dimensions, AI provider, or schema. When done, walk the acceptance checklist and tell me the status of each item. If you need to deviate (e.g. license), stop and ask.
