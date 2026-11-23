# Loop: flutter-ai-assistant

Goal: The Flutter web client gets the same assistant as Vue — Ask sheet, inferred goal label with override, citations that open dishes, capability and quota controls, history list — with no server change.

Check:
- `cd flutter_web_dev && flutter test` → all pass, count above 77
- `cd flutter_web_dev && flutter analyze --no-fatal-infos` → no new issues
- `cd server && npm test` → 221 pass, 0 fail (proves no server regression)
- `flutter build web --base-href /flutter/` succeeds and `server/web` is refreshed

Non-goals: no server/API changes, no Vue changes, no new Flutter dependency, no design-language change, no editor/route refactor beyond the Ask entry.

Budget: 8 iterations / 120k tokens.

Plan: docs/superpowers/plans/2026-11-23-flutter-ai-assistant.md

Iteration: 1
Next action: Task 1 — API client for /api/ai/* with an SSE parser and unit tests.

Log:
- [0] preflight: recon done (ApiClient.send + BrowserClient withCredentials support streaming; AppState holds auth/quota state; i18n via I18n). Check fixed. Calls recorded: full parity including capability selector and history controls; reuse Vue contract as-is.
