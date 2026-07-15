# Module 3 — AI Provider Layer

**Status:** Done.
**Depends on:** Module 2 (the narrow embedding function this module
replaces underneath, and the API conventions this module must follow).
**Unblocks:** Module 5 (scoring), Module 6 (company research), Module 7
(Resume Brain drafting) — every module that calls a chat or embedding
model goes through this layer, never around it.

This is a build contract for an implementer (human or AI). Prefer precise
contracts over solution code. Do not paste full adapter code or client
implementations into this file — describe the interface in prose and
tables.

---

## Goal

Replace Module 2's narrow, hard-coded embedding call with a proper
provider-agnostic adapter that every future AI-calling module (scoring,
research, drafting, follow-up, interview prep, negotiation) uses for both
chat completions and embeddings, so switching models or providers later is
a configuration change, never a rewrite of calling code.

Success = every AI call in `apps/api` goes through one adapter interface;
switching `AI_PROVIDER` in an env var and restarting the API is the entire
migration path to a different provider; nothing calling code depends on.

---

## In scope

- A single adapter interface with two capabilities: a chat/completion call
  and an embedding call, described in the Interface Contract section
  below (prose, not code).
- A default implementation wrapping **Cloudflare Workers AI**, covering
  both capabilities (chat + embed).
- Provider selection via a single environment variable, with Cloudflare as
  the default when unset.
- Retry/backoff behavior for transient failures (rate limits, timeouts),
  and a clear, typed error surfaced to callers when a provider call fails
  after retries — never a silent empty response.
- Swapping Module 2's narrow embedding function to call through this
  adapter instead, with no change required in the chunking/storage
  service that calls it.
- Basic usage/cost visibility: log which model and provider handled each
  call, and token counts if the provider returns them, so later cost
  questions ("what is this actually costing me") aren't a mystery.

## Out of scope

- Actually adding a second provider implementation (OpenAI/Anthropic/
  OpenRouter direct) — only the seam for one is required now; building a
  second implementation happens only if/when actually needed.
- Scoring, research, or drafting logic that will use this adapter (later
  modules) — this module only builds the pipe, not what flows through it.
- Any UI changes — this is a backend-only module. **Not a chatbot.**
- Fine-tuning, prompt-caching strategy, or streaming responses — add these
  only when a specific later module needs them.

---

## Dependencies (read first)

| Doc | Use |
|-----|-----|
| `docs/ARCHITECTURE.md` | Provider abstraction principle, secrets split |
| `docs/DATA_MODEL.md` | Embedding dimension (1024) already locked |
| `docs/modules/02-knowledge-base.md` | The narrow embed function being replaced, and the API conventions to keep following even though this module has no new routes |

---

## Decisions (locked for Module 3)

### Interface contract
The adapter exposes exactly two capabilities to the rest of `apps/api`:
- **Chat**: given a list of messages (role + content) and optional
  parameters (model override, max tokens, temperature), returns the
  model's reply text plus basic metadata (model used, token counts if
  available).
- **Embed**: given a text string, returns a fixed-length vector matching
  the locked dimension (1024). Never returns a different dimension based
  on provider — if a future provider's native embedding size differs, the
  adapter is responsible for erroring clearly rather than silently storing
  a mismatched vector.

Callers only ever import this interface (`get_provider()` / `embed_text()`),
never a Cloudflare/OpenAI SDK directly. Route handlers and services call
the adapter; the adapter is the only place that knows which provider is
active.

### Provider selection
- One environment variable (`AI_PROVIDER`) selects the active provider
  (**Cloudflare** is the default and the only implementation built in this
  module).
- Model strings for chat and embedding are configured separately
  (`CHAT_MODEL`, `EMBEDDING_MODEL`) — never assume the same string works
  for both, and never let a chat-model change accidentally alter which
  embedding model is used, since that would silently invalidate the whole
  knowledge base's vectors.
- Defaults: chat `@cf/zai-org/glm-4.7-flash`, embed
  `@cf/baai/bge-large-en-v1.5` (1024-dim).

### Failure handling
- Transient errors (timeouts, rate limits, 5xx, and auth failures treated
  as retryable for a clear typed surface) get a small number of retries
  with backoff before failing.
- After retries are exhausted, the adapter raises a typed error that
  identifies which capability (chat/embed) and provider failed — callers
  decide how to surface that (e.g. scoring module marks a posting
  "scoring failed, retry later" rather than crashing the whole search
  run).

### Secrets
- Provider API key(s) live only in `apps/api/.env`, never touch
  `apps/web` or the CareerOS Runner, consistent with `ARCHITECTURE.md`.
  Cloudflare: `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`.

---

## Deliverables

| Deliverable | Notes |
|-------------|-------|
| Adapter interface | Chat + embed capabilities, defined once |
| Cloudflare implementation | Default, both capabilities |
| Provider selection | Env-var driven, Cloudflare default |
| Retry/backoff | Applied to both capabilities |
| Typed failure surface | Identifies capability + provider on failure |
| Usage logging | Model + provider + token counts per call |
| Module 2 embed call migrated | `embed_text()` delegates to adapter; knowledge service unchanged |

---

## Acceptance criteria

- [x] A chat call and an embed call both succeed against Cloudflare
  through the adapter interface, not a direct SDK call anywhere in
  callers outside `apps/api/ai/`.
- [x] Changing the provider env var (even without a second implementation
  built) doesn't break the app — it should fail with a clear
  "provider not implemented" error rather than a crash, proving the seam
  is real.
- [x] A simulated transient failure (e.g. a bad API key temporarily, or a
  forced timeout) triggers retries, then a clear typed error, not a hang
  or a silent empty result.
- [x] Module 2's upload flow still works end to end, now calling through
  this adapter instead of its old narrow function.
- [x] Embedding dimension mismatches (if ever produced) are caught and
  rejected rather than silently stored.
- [x] No scoring/research/drafting logic was added here.

---

## How an implementer should work

1. Read this file, `ARCHITECTURE.md`'s provider-abstraction section, and
   Module 2's spec for what's being replaced.
2. Define the adapter interface first, in isolation from any specific
   provider.
3. Implement the Cloudflare Workers AI version against that interface.
4. Wire provider selection via env var, defaulting to Cloudflare.
5. Add retry/backoff and typed failure handling.
6. Migrate Module 2's embed call to use the adapter; confirm nothing else
   in the chunking/storage path changed.
7. Verify acceptance criteria.
8. Stop. Do not start Module 4 until its own spec exists.

## How to verify

1. Run Module 2's upload flow end to end and confirm chunks still embed
   correctly, now via this adapter.
2. Temporarily set an invalid API key and confirm the adapter retries,
   then fails with a clear, identifiable error (not a silent hang).
3. Set the provider env var to an unimplemented value and confirm a clean
   "not implemented" error rather than a crash.
4. Check logs for a call and confirm model/provider/token counts are
   visible.

---

## Open questions

| Question | Resolution |
|----------|------------|
| Second provider implementation (OpenAI/Anthropic/OpenRouter) | Deferred until actually needed |
| Streaming responses | Deferred until a module needs them (none currently do) |
| Prompt caching | Deferred; revisit if AI costs become material once scoring/drafting are live |

---

## Non-goals reminder

No scoring, research, or drafting logic in this module — those are
Modules 5, 6, and 7, and they consume this adapter rather than build their
own AI calls. No chatbot UI.

---

## Shipped notes

- Layout: `apps/api/ai/{types,errors,retry,cloudflare,factory,embed,budget}.py`
- Facade: `embed_text()` still the Module 2 entrypoint; internals call
  `get_provider().embed()`.
- Env: `AI_PROVIDER=cloudflare`, `CHAT_MODEL`, `EMBEDDING_MODEL`,
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.
- Daily Neuron guard: `AI_DAILY_NEURON_BUDGET` (default 9000). Estimates
  Neurons from token counts and refuses further AI calls with HTTP 429
  until 00:00 UTC. Set `0`/`off` to disable. State file:
  `AI_BUDGET_STATE_PATH` (default `/tmp/careeragent_ai_neuron_budget.json`).
  Estimates are best-effort — not Cloudflare's official billing meter.
