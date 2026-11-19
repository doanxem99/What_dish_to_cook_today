# Loop: ai-assistant

Goal: Ship the approved AI assistant (chat, embeddings, history, admin metrics) so all four suites pass and the new UI has no P0/P1 findings.

Check: `npm test --prefix server` and `npx vitest run` in `web_ui` and `flutter test` in `flutter_web_dev` all report 0 fail; `npm run build` in `web_ui` succeeds; `impeccable detect` on the Ask panel and admin AI view exits 0 or reports only P2/P3.

Non-goals: no fine-tuning, no board ranking change, no prompt text in admin, no new runtime npm dependency, no internal docs in the corpus, Flutter gets the recorder only (no assistant UI).

Budget: 8 iterations / 120k tokens (wave of tasks per iteration).

Plan: docs/superpowers/plans/2026-11-19-ai-assistant.md

Iteration: 8 (finish)
Next action: none — verification passed; branch ready for integration.

Log:
- [3] act: Tasks 6-7, commit 725075d (chat.js, /api/ai routes, admin AI endpoints). observe: server 179 pass / 0 fail; SSE events meta/tool/token/done/error. check: green.
- [4] act: Tasks 8-9, commit 1ed96be (SSE client, ask panel, dish cooked, profile history, 74 i18n keys). observe: web 74 pass / 0 fail; build green. check: green.
- [5] act: Tasks 10-11, commit 2c352e0 (Flutter recorder, rebuilt server/web, admin AI tab, user AI controls). observe: flutter 77 pass, analyzer clean on changed files, web 75 pass, server 179 pass, both builds green. check: green.
- [6] act: Tasks 12-13, commit 3296f39 (Ollama Compose, env, docs, impl record). observe: server 180, web 75, flutter 77, dotnet self-check pass, compose config ok, detector 0 findings. check: green.
- [7] review (kimi-k3.1-pro): CHANGES REQUIRED, 3 P1 (ungrounded prose, late abort, quota race) + 3 P2. fix round 1: 46c5d2f, server 192.
- [7] re-review: CHANGES REQUIRED, 3 P1 (case-sensitive grounding, abort after append, no checks after metric write) + streaming regression (buffered). fix round 2: a6414dc, server 203.
- [8] verify: server 203 / 0, web 75 / 0, flutter 77 / 0, dotnet self-check 68 PASS, compose config valid, detector 0, ai-check lists models + `skipped: no key`. check: green.

Log:
- [0] preflight: design approved, plan read, branch feat/ai-assistant, design committed 4f76cbe. Check commands fixed. Note: no OPENCODE_API_KEY in env, so Task 2 will record `skipped: no key`.
- [0] ruling: provider default base URL follows the approved design (`https://opencode.ai/inference/go/openai/v1`), not the plan's earlier `zen/go/v1`; both answer, env override stays. Update the plan line when Task 1 lands.
- [1] act: Tasks 1-2, commit 8a093db (schemas, config + cost table, provider adapter, ai-check). observe: server 157 pass / 0 fail; ai-check lists models, `skipped: no key`, exit 0. check: green.
- [2] act: Tasks 3-5, commit 07cc8be (help corpus, embeddings + ai_index, events, six tools). observe: server 171 pass / 0 fail. check: green.

Stop reason:
Degraded: none
