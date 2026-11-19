# AI assistant — design

Date: 2026-11-19
Status: draft for approval
Prior art in this repo: `docs/superpowers/specs/2026-11-18-admin-operations-design.md`

## Intent

The site answers "what can I cook with what I have" by ranking a curated catalog. It cannot explain a
choice, walk someone through a recipe, or answer "how do I use this feature". It also cannot learn
what a cook actually cooked; it has votes, comments and post authorship, but no history of intent.

This design adds one assistant inside the existing Vue app: one conversation surface, three task
modes, three capability levels, grounded in the catalog through tools and local embeddings. It also
adds the history signal the suggestions need, and it fills the AI metrics panel the admin area
already reserves.

## Goals

- A signed-in cook can ask, in English or Vietnamese, what to cook from ingredients they have, get a
  shortlist that links to real dishes, and read why each was chosen.
- The assistant can walk a cook through a dish's steps, and answer questions about using the site.
- Suggestions use explicit signals (votes, comments, own posts) and an implicit event history
  (views, cooked marks, ingredient picks).
- Every AI call is measured: model, latency, tokens, cost, errors. No prompt or reply text in admin.
- Personal data stays explainable: the user can see and delete their history.
- The provider can change (OpenCode Go hosted, Ollama local) without touching tools or UI.

## Non-goals

- Fine-tuning a model. The catalog changes; facts come from tools, not weights.
- Anonymous use, guest trials, voice, images, or an AI author for dishes.
- AI in the Flutter client in v1. It gets the event recorder only, so history is not split by client.
- Autonomous catalog or account changes. Votes, comments, publishing and admin actions stay clicks.
- Prompt caching, evaluation dashboards, or multi-turn tool planning beyond three tool rounds.

## Anti-goals

- An answer that names a dish not in the catalog.
- Prompt or reply text visible to an admin.
- A per-message spend nobody can cap.
- The model writing to the database without an explicit user confirmation.
- Retrieved text (comments, posts, docs) being able to change the assistant's rules.

## Decisions already made

| Topic | Decision |
|---|---|
| Surface | One Ask surface, three task modes as chips |
| Task modes | Cook with what I have · Walk me through · Help me use the app |
| Capability | Read only (default) · Prepare and confirm · Act freely, bounded |
| Access | Signed-in accounts only |
| Chat provider | OpenCode Go, `deepseek-v4.1-flash` default, OpenAI-compatible |
| Embeddings | Local Ollama `bge-m3`, multilingual |
| Retrieval | Embeddings over catalog, posts and docs, plus exact tools |
| History | `user_event` log: dish viewed, dish cooked, ingredient picked, chat message |
| Quota | 20 messages/day per account, admin can lower or disable |
| Transcripts | Last 20 messages per user, 30-day TTL, user can delete |
| Language | Interface locale; Vietnamese answers include Vietnamese dish names |
| Admin visibility | Metrics only; plus per-user disable and quota override |
| Help corpus | Curated allowlist only: `PRODUCT.md`, `README.md`, new `docs/help/` |
| Comments in context | Included, with a visible notice that matching text goes to the provider |
| History influence | Assistant suggestions only; the public board keeps ingredient-match order |
| Flutter | Gets the history recorder (viewed, cooked, picked), no assistant in v1 |
| History visibility | Full event list on the profile, with clear-all and delete-conversation |


## Resolved during the builder check

Verified against the live endpoint and the code:

- `GET https://opencode.ai/zen/go/v1/models` answers 200 unauthenticated and lists the models. `POST .../chat/completions` **requires** an `x-opencode-session` header (`400 MissingSessionID` without it) and then an API key. The design's open question is closed: the server sends a per-conversation UUID in that header.
- The model metadata advertises tool support and prices in USD per million tokens with a weekday multiplier. Default base URL is the metadata one (`https://opencode.ai/inference/go/openai/v1`), overridable; the first task with a real key confirms tool calls on that path.
- Recipe steps are `dish_post.display_blocks`, not `dish.steps`. `get_dish` resolves the best post first.
- Pantry selection lives in the browser (`pantry_store.js`), so `select_ingredients` returns an SSE action the client applies. No server write.
- `/api/ai` is already covered by maintenance; signed-in identity comes from `verifyToken`; admin routes keep the `{error:{code,message}}` shape and write audit rows.
- The existing AI admin view reads `/api/admin/jobs?type=ai`; it is rewritten to read `ai_call` only.
- Quota is counted from completed `ai_call` user turns, not from `user_event` (which dedupes per day). Stopped or failed replies do not consume a message.

Settled by the builder, recorded here as calls:

- `ai_index` gets its own timeout and coalesces per row; it is enqueued from the content write paths.
- Transcripts use one rolling conversation per user, 20 messages, 30-day TTL; `conversation_id` on `ai_call` points at it.
- Cost is a hardcoded per-model table labelled estimated; the plan's usage units are not dollars, so `AI_MONTHLY_BUDGET_USD` is a soft stop.
- `dish_cooked` stores the resolved dish id even when the page was opened by post id.
- `start_draft` passes a prefill through the router; nothing is saved.
- Compose pulls the `bge-m3` model on first start and pins `OLLAMA_URL=http://ollama:11434`.

## Approaches considered

**A. Tools only, no embeddings.** Three tools query Mongo: dishes by selected ingredients through
the existing selection engine, one dish by id, help from docs and catalog. Cheapest and exact at 38
ingredients and 13 dishes. Rejected because a fuzzy question ("something warm with noodles") finds
nothing when the user did not pick ingredients, and the help corpus is prose.

**B. Embeddings over catalog, posts and docs, plus tools (chosen).** Content is embedded locally,
stored with a content hash, and refreshed by a job. A question embeds to a vector, top-k passages
become context, and tools still fetch exact rows so every dish in an answer is real and linkable.
Trade-off: a new local service, an index to keep fresh, and a re-embed cost when content changes.
Accepted because recall is the difference between a search box and an assistant.

**C. Hybrid: tools plus a Mongo text index, embeddings later.** Almost A, with fuzzy matching and a
seam for vectors. Rejected once the choice was embeddings: doing both adds two retrieval paths to
debug for one product.

## How it works

### Conversation surface

```text
Ask panel (Vue, drawer on desktop, full-screen sheet on mobile)
  mode chips: Cook · Walk through · Help
  capability: Read only (default) · Prepare & confirm · Act freely
  message list: user, assistant, tool chip ("looked at 5 dishes"), citations
  input: 1-2000 chars, send, stop
  states: signed-out, thinking, streaming, stopped, quota reached, disabled, error
```

- A signed-out visitor sees the panel with a sign-in prompt and no way to send.
- Each answer renders dish and ingredient names as links to the existing pages, built from tool
  results, never from model text.
- Answers stream. A stop button aborts the request and keeps the partial reply marked "stopped".
- Everything is bilingual through the existing catalogues; the assistant answers in the interface
  language.

### Request flow

```text
POST /api/ai/chat (SSE)
  requireAuth, AI enabled, not maintenance, quota not reached
  1. persist the user message, load last 10 turns for context
  2. embed the question (Ollama)
  3. retrieve top 6 passages from ai_embedding by cosine
  4. build messages: system rules, retrieved passages as data, history, question
  5. call the model with the tool list for the chosen capability
  6. stream tokens; on tool call, run the tool server-side and continue (max 3 rounds)
  7. persist the assistant message, write ai_call metrics, decrement quota
  errors: 429 quota, 503 provider down, 502 provider error, 500 unexpected
```

- Tool list by capability: read tools always; prepare tools return a preview instead of applying;
  free tools apply reversible changes only.
- The system prompt states that retrieved text is data, never instructions, and that dishes must
  come from tool results.
- Tool calls are validated server-side (ids exist, names match the catalog, limits bounded).
- Prompt text is never logged and never stored in `ai_call`.

### Tools

| Tool | Capability | Effect |
|---|---|---|
| `search_dishes({ingredients, query, limit})` | read | ranks catalog dishes, returns ids, names, reasons |
| `get_dish({dish_id})` | read | steps, amounts, nutrition, image, link |
| `get_help({topic})` | read | passages from docs and catalog facts, with source paths |
| `select_ingredients({names})` | prepare | returns a preview list; applies only after the user confirms |
| `open_dish({dish_id})` | free | returns a link the client navigates to |
| `start_draft({name, ingredients})` | prepare | opens the dish editor with a prefilled draft, nothing saved |

`select_ingredients` and `start_draft` never write in read-only or prepare mode. In act-freely mode
`select_ingredients` may apply, because it only changes the current board selection; `start_draft`
stays confirm-only, since saving is a click the person makes.

### History and personalisation

```text
user_event
  user_id, type, target_type, target_id, created_at
  type: dish_viewed | dish_cooked | ingredient_picked | chat_message
  dedupe: one row per user, type, target per day
  TTL: 90 days

signal:
  explicit  votes, comments, own dish posts
  implicit  cooked (weight 3), picked (2), viewed (1)
```

- "I cooked this" is a button on the dish page, stored as `dish_cooked` with the resolved dish id.
- The profile gains: AI capability selector, today's message usage, a paginated event list (viewed,
  cooked, picked, chat), "clear my history" and "delete conversation".
- History changes only what the assistant suggests. The public board keeps ingredient-match order,
  so nobody sees an unexplained reorder.
- The Flutter client records `dish_viewed`, `dish_cooked` and `ingredient_picked` through the same
  endpoint; it does not host the assistant in v1.

### Embeddings and index

```text
ai_embedding
  target_type: dish | dish_post | ingredient | doc
  target_id, locale, source_hash, text, vector[], model, updated_at
  unique (target_type, target_id, locale, model)

refresh:
  content write enqueues one ai_index job for that row (debounced per row)
  admin gets "Rebuild index" on the AI tab
  job embeds missing or changed hashes only; deletes embeddings for removed rows
```

- Cosine similarity is computed in Node over the small set, with a `shortcut:` note: switch to a
  vector index when the embedded row count passes ~20k.
- Retrieval filters by locale when the interface language is Vietnamese and falls back to English
  passages when Vietnamese ones are missing.
- **Docs corpus is an allowlist**: `PRODUCT.md`, `README.md` and `docs/help/*.md`, a new folder of
  user-facing pages. `docs/superpowers/`, `docs/impl/`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md` and
  `API.md` are never embedded, so admin notes and known security gaps cannot surface in an answer.
- Comment and post passages are embedded and may be retrieved. Because that text leaves the server,
  the Ask panel states it once, in both languages: "Answers may use public dish comments; they are
  sent to the AI provider."

### Metrics and admin

```text
ai_call
  user_id, conversation_id, provider, model, mode, capability,
  latency_ms, tokens_in, tokens_out, cost_estimate, status, error_code, created_at
  no prompt, no reply, no retrieved text

GET /api/admin/ai/usage     counts, tokens, cost, errors by day and model
POST /api/admin/ai/enabled  {enabled}
POST /api/admin/ai/users/:id  {disabled, daily_limit}
```

- The AI tab stops being hidden once `AI_ENABLED` is true; it shows real rows from `ai_call`.
- Cost is estimated from configured per-1k prices; OpenCode Go bills by plan, so the column is
  labelled estimated and token counts are the exact figure.
- A single disable switch stops new calls; in-flight replies finish.

### Data and privacy

- Retrieved passages include comment text. Only passages matching the question are sent to the
  chat provider; embeddings stay local.
- Transcripts are per user, capped at 20 messages, expire in 30 days, and are deletable by the owner.
- Admin responses never carry message text; `ai_call` has counts only.
- Event history is personalisation input; the user can see it, clear it, and it expires in 90 days.
- The Ask panel carries one notice that retrieved comment text is sent to the AI provider. The
  curated help corpus excludes internal docs, so no admin or security note is retrievable.

### Configuration

```text
AI_ENABLED=false
AI_PROVIDER=opencode-go            # or ollama
OPENCODE_API_KEY=                  # only for opencode-go
AI_MODEL=deepseek-v4.1-flash
AI_BASE_URL=https://opencode.ai/inference/go/openai/v1
EMBED_PROVIDER=ollama
EMBED_MODEL=bge-m3
OLLAMA_URL=http://localhost:11434
AI_DAILY_MESSAGE_LIMIT=20
AI_MAX_TOOL_ROUNDS=3
AI_MONTHLY_BUDGET_USD=10           # soft stop: disables calls and shows it in admin
```

- Compose gains an `ollama` service with a models volume; the server waits for it like LibreTranslate.
- With `AI_ENABLED=false` the panel is hidden, the routes answer 404, and the admin tab explains how
  to turn it on.

## Acceptance criteria

- A signed-in user gets a streamed answer that cites only real catalog dishes, in EN and VI.
- A signed-out visitor cannot send a message or spend a token.
- Quota: the 21st message in a day answers 429 and the UI says when it resets.
- Capability: in read-only, no tool changes data; in prepare, changes return a preview needing a
  click; in act-freely, only reversible actions apply.
- History: viewing a dish, cooking it, or picking an ingredient writes one row per day; clearing
  history removes them; 90-day TTL deletes the rest.
- History is visible to its owner as a paginated list; the Flutter client records the same events.
- The assistant never reads internal docs: a question about the project's own design returns a
  help answer or says it does not know.
- Embeddings: editing a dish re-embeds only that row; deleting it removes the vector; a rebuild
  covers everything; retrieval returns the edited text next question.
- Admin: metrics show model, latency, tokens, cost and errors; no prompt text anywhere; the disable
  switch stops new calls.
- Failure paths: provider down → 503 with a readable message; embedding service down → answers fall
  back to tool-only retrieval and say so once.

## Risks and open points

- **Provider terms**: OpenCode Go is sold for coding use; plan limits apply per account
  (`monthly_usage` 100/200/105 by tier). Confirm the intended use and keep the demo key separate.
  The endpoint needs `x-opencode-session`, verified; tool calls on the chosen base path still need
  one real-key check on day one.
- **Prompt injection**: comments and posts are user text and are now deliberately in the retrieval
  set. Mitigated by treating retrieved text as data, refusing instruction-bearing content, and
  never letting a tool perform a privileged action.
- **Comment exposure**: matching comment text goes to the chat provider. Accepted with a visible
  notice; embeddings stay local.
- **Cost drift**: token counts are exact but prices can change; the budget stop is a soft guard.
- **Local embeddings**: `bge-m3` needs a few GB of RAM; on a small server it competes with Mongo and
  the server process. Compose documents the requirement and pulls the model on first start.
- **Vietnamese quality**: DeepSeek handles Vietnamese acceptably but not natively; answers should be
  checked by a Vietnamese reader before launch.
- **Flutter scope**: this delivery adds the event recorder to Flutter, which means a Dart change,
  a web build and a copy into the generated `server/web/`. The assistant itself stays Vue-only.
