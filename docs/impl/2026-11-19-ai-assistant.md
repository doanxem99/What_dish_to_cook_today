# AI assistant implementation record

Date: 2026-11-19
Plan: [docs/superpowers/plans/2026-11-19-ai-assistant.md](../superpowers/plans/2026-11-19-ai-assistant.md)
Spec: [docs/superpowers/specs/2026-11-19-ai-assistant-design.md](../superpowers/specs/2026-11-19-ai-assistant-design.md)
Branch: `feat/ai-assistant`

This record covers Tasks 12 and 13: the Compose/Ollama deployment, the image-side doc corpus,
the documentation updates, rebuilt client bundles and the verification run.

## What shipped

- Compose gains an `ollama` service on `ollama/ollama:latest` with the `ollama-models` volume.
  Its entrypoint starts `ollama serve`, waits for the API, pulls `EMBED_MODEL` (`bge-m3`) once,
  then waits on the server process. The healthcheck runs `ollama list`; restart policy is
  `unless-stopped`.
- The `server` service pins `OLLAMA_URL=http://ollama:11434`, `EMBED_MODEL=bge-m3` and forwards
  all 11 AI variables. It depends on `ollama` with `service_started`, so a slow first model pull
  never blocks the site; retrieval degrades to tool-only and the stream reports `embed_down`.
- `Dockerfile` copies `PRODUCT.md`, `README.md` to `/` and `docs/help/` to `/docs/help/`. The
  embedding loader climbs from `/app/config/ai` to the filesystem root, so the allowlist resolves
  identically in the image and in a checkout.
- `.dockerignore` now excludes `docs/*` but re-includes `docs/help`, because the image build
  context previously dropped all of `docs/`.
- Root [.env.example](../.env.example) and [server/.env.example](../server/.env.example) document
  all 11 AI variables with safe defaults (`AI_ENABLED=false`, empty `OPENCODE_API_KEY`).
- [README.md](../README.md) gains an AI assistant section: the three modes, three capability
  levels, the comment-text notice, quota, history, how to enable it and the `bge-m3` RAM cost.
  The environment table lists every AI variable.
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) documents the fourth service and fifth volume, the
  `config/ai/` modules, the chat request flow, SSE event names, the doc allowlist and the admin AI
  view.
- [docs/API.md](../API.md) documents `/api/ai/status`, `/api/ai/chat` (SSE event names), the
  conversation, capability and event routes, plus `/api/admin/ai/*` and the richer `/health.ai`.
- [docs/DATA_MODEL.md](../DATA_MODEL.md) documents `ai_embedding`, `ai_conversation`, `ai_call`,
  `user_event`, the new `user` AI fields, the `ai_enabled` setting and the `ai_index` job.
- [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md) records the missing real-key provider test, the
  absent Flutter assistant, the UTC-day quota and the in-process cosine limit.
- `server/test/hosting.test.js` gains a deployment guard for the Ollama service, `OLLAMA_URL`,
  `OPENCODE_API_KEY`, the image doc copy and the env template defaults.
- Rebuilt client bundles: `server/web_ui` from `npm run build` and `server/web` from
  `flutter build web --base-href /flutter/` plus a copy of `build/web/*`.

## Decisions

- **Pull on first start, not a separate init step.** The Ollama image has no model manager, so the
  compose command does the pull. Keeping it in the service means `docker compose up` is still the
  only command an operator needs. The volume makes the pull a one-time cost.
- **`service_started`, not `service_healthy`, for the server dependency.** A healthy check would
  wait for a multi-GB download and delay the whole site. The server already tolerates a missing
  embedding service and answers from tools.
- **Root-level doc paths in the image.** `AI_DOC_ROOT` stays unset in Compose: the loader's
  `../../..` from `/app/config/ai` is `/`, which is where the image copy lands. Setting
  `AI_DOC_ROOT=/` would be redundant.
- **Documentation describes the shipped routes, not the plan.** The old "AI is reserved" text in
  the README, ARCHITECTURE, API, DATA_MODEL and KNOWN_ISSUES is replaced with the actual
  behaviour: 404 while off, the five SSE frames, the four collections and the admin routes.
- **No full stack start in this pass.** `docker compose up` would download `bge-m3`; the task
  asked for config validation only. `docker compose config --quiet` with a temporary `.env`
  containing `JWT_SECRET` is the verification used here.

## Verification

Commands were run from the repository root unless noted.

| Suite / check | Command | Before | After |
|---|---|---|---|
| Server unit and route tests | `npm test --prefix server` | 179 passed, 0 failed | 180 passed, 0 failed |
| Vue unit tests | `npx vitest run` in `web_ui` | 8 files, 75 passed | 8 files, 75 passed |
| Flutter widget tests | `flutter test` in `flutter_web_dev` | 77 passed | 77 passed |
| C# offline self-check | `dotnet run --project db_seed_tests` | 68 PASS, `ALL CHECKS PASSED` | 68 PASS, `ALL CHECKS PASSED` |
| Compose validity | `docker compose config --quiet` with temp `.env` (`JWT_SECRET`) | not run | exit 0 |
| Impeccable detector | `impeccable.cmd detect --json web_ui/src/components/ask_panel.vue web_ui/src/views/admin/admin_ai.vue` | not run | `[]` (0 findings) |
| Provider check | `node server/scripts/ai-check.mjs` | not run | `skipped: no key` (models list reachable) |

`flutter analyze` was not part of this run; the plan's Task 13 lists it, but the changed Flutter
surface here is only the committed build output. The web build emitted only the existing Flutter
`index.html` deprecation warnings for `serviceWorkerVersion` and `FlutterLoader.loadEntrypoint`.

The detector ran on the two files named by the task; it returned an empty array, so there were no
P0/P1 findings to fix and no build re-run was needed.

## Remaining gaps

- No live provider call has been made. All tests stub the provider and `ai-check` reports
  `skipped: no key`; tool calling on the default OpenCode Go path still needs one real-key run.
- Flutter records history events but has no Ask panel or profile AI controls.
- The quota window is UTC, not the user's local day.
- Retrieval scores every `ai_embedding` row in the Node process; move to a vector index near
  20k rows.
- `bge-m3` needs a few GB of RAM; on a small host it competes with MongoDB and the server.
- `admin_job` keeps legacy AI metric columns that `ai_index` does not use; `ai_call` owns the
  assistant metrics.
- Grounding covers dish names only; an invented ingredient name is not removed.
- A dish phrase split across two streamed chunks is sanitised by the final whole-text pass, so the
  persisted text can differ from the concatenated chunks in that rare case.
- Quotes are buffered by sentence, so a token event arrives per sentence rather than per model
  token; a stop still ends the reply at a sentence boundary.

## Review rounds

An independent review found three P1 defects, all fixed in `46c5d2f`: model prose could name a dish
with no tool call, abort handling started too late and billed aborted calls, and quota admission was
not atomic. A second verification round found the grounding check was case-sensitive, abort after
the transcript append stored a full answer, and buffering had broken token streaming; all three are
fixed in `a6414dc`, which streams grounded sentences, finalises calls and messages exactly once, and
rolls back a reservation on any post-increment failure.

Final counts after both rounds: server 203 tests, web 75, Flutter 77, self-check 68, detector 0
findings, compose config valid.
