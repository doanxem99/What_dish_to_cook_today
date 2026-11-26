# Cooking walkthrough and history-aware suggestions — plan

Date: 2026-11-26
Branch: `feat/cooking-depth`
Answers: manual timer per step · history-aware strip on the board · Vue first, Flutter follow-up.

## Intent

Two product gaps after the AI work. The board ranks by ingredient match but ignores what the cook has actually cooked; and a dish page shows steps as prose with no way to follow them while cooking.

## Feature A — For you tonight strip

Server `GET /api/dish/suggestions?ingredients=<ids>&limit=3` (verifyToken):

```text
candidates = dishes whose best post contains any pantry ingredient
score       = match_count * 2
            + 3 if user cooked this dish in the last 90 days (user_event dish_cooked)
            + 1 if picked recently (ingredient_picked on its ingredients)
            + 0.1 * points
reason codes = matches_pantry | cooked_before | picked_before | popular
```

Response `{rows: [{dish_id, name, name_vi, image, servings, score, reasons: []}]}`. Deterministic, no model call, names only from the catalog.

Vue: a compact "For you tonight" strip above the board when the pantry is non-empty and the user is signed in; three rows, each a link, each with its reason as a short label. Hidden when empty or signed out.

## Feature B — Cooking walkthrough

Route `/cook/:dishId` (requires sign-in for the save-free view; a signed-out cook may still read steps).

- Loads the dish and its best post through the existing detail endpoints.
- Steps are the post's `display_blocks` where `type === 'text'` and text is non-empty, keeping EN and VI per locale.
- Full-screen layout: step `n / total`, the step text at reading size, Back / Next, and a timer panel.
- Timer: presets 5, 10, 15 minutes plus custom minutes; start, pause, resume, reset, stop. A beep at zero via WebAudio, a tab-title countdown, and the timer survives moving between steps within the walkthrough.
- Entry: a "Start cooking" button on the dish page beside "I cooked this".
- Completing the last step offers "I cooked this" and returns to the dish.
- Keyboard: left/right steps, space toggles the timer when it has a duration.
- No wake-lock, no notifications; the tab title is the only background signal.

## Files

| Path | Change |
|---|---|
| `server/routes/api/dish_suggestions.js` (new) | ranking endpoint |
| `server/routes/api/dish.js` | mount it |
| `server/test/dish_suggestions.test.js` | ranking, reasons, auth, empty pantry |
| `web_ui/src/api/{dish,admin}.js` | suggestions helper |
| `web_ui/src/components/for_you_strip.vue` (new) | three-row strip |
| `web_ui/src/views/home_view.vue` | mount the strip |
| `web_ui/src/views/cook_view.vue` (new) | walkthrough + timer |
| `web_ui/src/router/index.js` | `/cook/:dishId` |
| `web_ui/src/views/dish_detail_view.vue` | "Start cooking" entry |
| `server/public/i18n/{en,vi}.json` | strip and walkthrough keys |
| `docs/API.md`, `docs/KNOWN_ISSUES.md` | endpoint and gaps |

## Verification

- `server npm test` (222 plus new), `web_ui npx vitest run` (77 plus new helpers), `npm run build`.
- Live: pantry with two ingredients, strip shows three reasoned rows; open a dish, start cooking, step through, run a 1-minute timer to zero, mark cooked.
- Flutter is a follow-up delivery; the strip and walkthrough are Vue-only in this pass and recorded as such.

## Out of scope

- Auto-parsing durations from step text.
- Push notifications, wake lock, background audio.
- Assistant-generated suggestions.
