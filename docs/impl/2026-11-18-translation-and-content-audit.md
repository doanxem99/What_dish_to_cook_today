# Translation failure and content audit — implementation

Goal: make a failed auto-translation visible in the dish editor, and record catalog creation in the admin audit log.

Plan: [docs/superpowers/plans/2026-11-18-translation-and-content-audit.md](../superpowers/plans/2026-11-18-translation-and-content-audit.md)

## Files

| Path | Responsibility |
|---|---|
| `web_ui/src/components/translation_error.js` | map an HTTP status to a failure reason key |
| `web_ui/src/components/translation_error.test.js` | prove the mapping |
| `web_ui/src/components/blocks_editor.vue` | show and clear the inline failure, keep typed text |
| `web_ui/src/views/dish_edit_view.vue` | use the same message for scalar fields |
| `web_ui/src/views/ingredient_edit_view.vue` | same, if it translates fields |
| `server/public/i18n/en.json`, `vi.json` | new `edit.translate.*` keys |
| `server/routes/api/dish_profile.js` | audit `dish.create`, `dish_post.create`, `comment.delete` |
| `server/routes/api/ingredient_profile.js` | audit `ingredient.create`, `ingredient_post.create` |
| `server/test/audit_content.test.js` | one row per successful create, none on failure |
| `docs/API.md`, `docs/DATA_MODEL.md`, `docs/KNOWN_ISSUES.md` | document the actions and the growth risk |

## Interfaces

```js
// web_ui/src/components/translation_error.js
export function translationFailure(status) // 'notConfigured' | 'unreachable' | 'failed'

// server
recordAudit({ actorId, actorName, action, targetType, targetId, result, detail, ip })
```

New audit actions: `dish.create`, `dish_post.create`, `ingredient.create`, `ingredient_post.create`, `comment.delete`.

## Tasks

- [x] Task 1: failing test for `translationFailure` (503 → notConfigured, 502 → unreachable, 500/undefined → failed); implement; wire both editors; keys in EN and VI. Done: helper plus catalogue parity tests pass (59 total). `ingredient_edit_view.vue` needed no change: it has no Auto-translate control and never calls `/api/translate`.
- [x] Task 2: failing test that each successful create writes exactly one audit row with actor and target name, and a rejected create writes none; implement; docs.

### Task 2 notes

- Routes audit after the helper returns a success status, so the nested dish post inside
  `create_dish` does not add a second row.
- `create_dish_post` and `create_ingredient_post` also audit their edit path (`EditingSuccess`);
  the action stays `dish_post.create` / `ingredient_post.create` because the route is the only
  write path for a post.
- Target labels: `dish_post`/`ingredient_post` resolve to `<parent name> by <author>`; a
  `comment` row uses its stored `detail` excerpt because the delete removed the comment.
- Audit writes are best effort: a failed insert is swallowed so a created row is never reported
  as a failure.
- `server/test/audit_content.test.js` covers the five actions, the refused create, pagination,
  the action list and the three new label types.

## Verification

- `cd server; npm test` → all pass, count above 137.
- `cd web_ui; npx vitest run` → all pass, count above 53; `npm run build` succeeds.
- Live: dish creates appear in `/admin/audit`; a stopped translation service shows the inline error and keeps the text.

## Final state

- Server: 149 tests pass. Web: 68 tests pass. Build green.
- Live audit check on the demo: `POST /api/dish/profile/create_dish` wrote one row, `action=dish.create`, `target=Audit probe dish`, `actor=demo`, visible through `GET /api/admin/audit`.
- Bug found while running that check: `dev-demo.mjs` pinned the in-memory Mongo to port 27017, so an orphaned memory server from an earlier run was reused and the fresh seed collided on `role.name`. Fixed in `be2ac70`: the memory server now takes a free port. Consequence to note: killing the orphan dropped the demo data created in the preview.

## Review outcome

- P1 fixed: a slow early translation response can no longer overwrite newer text or user-typed Vietnamese; `shouldApplyTranslation` guards both editors.
- P2 fixed: errors are per field and per block identity, and survive a move or a sibling success; post edits log `dish_post.edit` / `ingredient_post.edit` instead of a second create; a failed audit insert is logged, not silently swallowed.
- P3 fixed: detail capped for every action, comment detail prefixed, parent ids validated before `$in`, client-supplied actor fallback removed, missing-parent label test added.



## Accepted risks

- Audit rows have no TTL; content edits grow the collection. Retention is a separate task.
- Votes are not audited; they are high-volume and have no moderation use yet.
