# Translation failure and content audit — plan

Date: 2026-11-18
Branch: `feat/admin-operations` (continues; no new branch needed)
Spec touchpoints: catalog editors, admin audit, `docs/KNOWN_ISSUES.md`

## Intent

Two gaps found while checking the admin preview:

1. With **Auto-translate** on, a failed `/api/translate` call is silent in the block editor, so a dish saves with an empty Vietnamese text and the VI page quietly falls back to English.
2. Creating a dish or ingredient is invisible in the admin area. Jobs are admin operations only, and the audit log records admin actions only, so content work leaves no trace.

The user chose: editor-only translation errors, and audit for catalog edits.

## Task 1 — Visible translation failure in the editors

Files: `web_ui/src/components/blocks_editor.vue`, `web_ui/src/views/dish_edit_view.vue`, `web_ui/src/views/ingredient_edit_view.vue` (if it uses blocks or the checkbox), `server/public/i18n/en.json`, `vi.json`, `web_ui/src/components/translation_error.js` + test.

Interface:

```js
// translation_error.js
export function translationFailure(status) // 503 -> 'notConfigured', 502 -> 'unreachable', other -> 'failed'
```

Behaviour:

- On a failed translate call, keep the typed text, keep the target empty, and set a visible inline error next to the affected field group: "Auto-translation failed: the translation service is not answering. Your text was kept; edit the field again to retry."
- 503 says the service is not configured; 502 says it is configured but not answering; anything else says the call failed.
- Both editors use the same wording through the helper and both i18n catalogues.
- Saving is never blocked; the error clears on the next successful translation or when Auto-translate is turned off.
- Test: helper mapping for 503, 502, 500/network, and an i18n parity check that the new keys exist in both catalogues.

## Task 2 — Audit catalog edits

Files: `server/routes/api/dish_profile.js`, `server/routes/api/ingredient_profile.js`, `server/config/admin/audit.js` (only if a helper is needed), `server/test/audit_content.test.js`, `docs/API.md`, `docs/DATA_MODEL.md`, `docs/KNOWN_ISSUES.md`.

Actions:

| Action | When |
|---|---|
| `dish.create` | successful `POST /api/dish/create_dish` |
| `dish_post.create` | successful `POST /api/dish/create_dish_post` |
| `ingredient.create` | successful `POST /api/ingredient/create_ingredient` |
| `ingredient_post.create` | successful `POST /api/ingredient/create_ingredient_post` |
| `comment.delete` | successful comment delete (moderation) |

Rules:

- Actor is `req.current_user`; `target_type` is `dish`, `dish_post`, `ingredient`, `ingredient_post`, `comment`; `target_id` is the created row id.
- `detail` carries the name (dish/ingredient) or a short body excerpt, never a password or token.
- A failed create writes nothing.
- Audit rows stay append-only; the existing `GET /api/admin/audit` action select picks the new actions up automatically.
- Tests: each create writes one row with the right action, actor and target; a rejected create writes none; the audit list still paginates.
- Docs: add the actions to `docs/API.md`; note in `docs/DATA_MODEL.md` that audit now includes content creation; add a `KNOWN_ISSUES` line that audit rows have no TTL and grow with content volume (retention is a later task).

## Verification

- `cd server; npm test` — 137 plus new, 0 fail.
- `cd web_ui; npx vitest run` — 53 plus new, 0 fail; `npm run build`.
- Live check with the demo: create a dish with Auto-translate off, confirm it saves and the VI page falls back; stop the translation service, create another dish with Auto-translate on, confirm the inline error appears and the text is kept; open `/admin/audit` and confirm the `dish.create` row names the dish.

## Out of scope

- Runtime translation of stored content.
- Audit for votes or edits that have no endpoints today.
- Audit retention, export or TTL.
