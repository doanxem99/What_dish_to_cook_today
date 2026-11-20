# Intent inference — plan

Date: 2026-11-20
Branch: `feat/ai-assistant`
Approved direction: the user types one sentence; the app picks the mode. No mode chips as a gate.

## Intent

Today the user must choose Cook / Walk through / Help before asking, yet those modes only change one line of the system prompt. Remove the choice, infer it, and show the guess as an editable label.

## Ladder

```text
message
 → rules (EN + VI keyword sets, page context)                  clear match wins
 → embedding prototypes (bge-m3, reuse the retrieval vector)   best mean above 0.62
 → default (pantry items present → cook, else help)
```

No classifier model call. An LLM tier stays a future option behind a flag.

## Mode becomes real

- `cook`: the prompt names the mode and asks for `search_dishes` first.
- `walkthrough`: if a catalog dish can be resolved from the message or the open dish page, the server pre-calls `get_dish` and injects its result before the model answers; otherwise the answer asks which dish.
- `help`: `get_help` is the expected tool.

## Files

| Path | Change |
|---|---|
| `server/config/ai/intent.js` | new: `inferMode`, prototype lists, rules, threshold |
| `server/config/ai/chat.js` | accept optional mode; infer when absent; prompt directive per mode; `mode_source` on call and transcript; expose mode in `meta` |
| `server/routes/api/ai.js` | `mode` optional; pass `mode_source`; accept `override: true` |
| `server/config/database/connection.js` | `AiCall.mode_source`; transcript message `mode_source` |
| `web_ui/src/components/ask_panel.vue` | chips removed; editable mode label above the answer; re-run on change |
| `web_ui/src/api/ai.js` | send mode only on override |
| `server/public/i18n/{en,vi}.json` | mode labels, "Change goal", notice |
| `docs/API.md`, `docs/impl/2026-11-19-ai-assistant.md` | document inference and the label |

## Tests

- `server/test/ai_intent.test.js`: EN and VI cases per mode; ambiguity falls to the default; embedding path used when rules miss (stubbed vectors).
- `server/test/ai_chat.test.js`: no mode → inferred mode in `meta` and on `ai_call.mode_source`; explicit mode → `mode_source: 'user'`; walkthrough with a known dish gets a `get_dish` tool result before the answer.
- `web_ui` unit test for the label helper and i18n parity.

## Verification

`npm test --prefix server`, `npx vitest run` in `web_ui`, `npm run build`, then a live ask with no mode chosen and one override.

## Out of scope

LLM classifier tier, per-user learned preferences, Flutter UI.
