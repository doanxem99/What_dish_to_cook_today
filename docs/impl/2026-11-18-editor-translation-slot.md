# Editor translation result and error slots — implementation

Goal: a slow or failed auto-translation lands on the field that asked for it, never on a newer edit, and each failure stays visible next to its field until that field succeeds.

Source: subagent fix list for the Vue findings on branch `feat/admin-operations` (HEAD `cbeffde`). No plan file; the review is the contract.

## Files

| Path | Responsibility |
|---|---|
| `web_ui/src/components/translation_error.js` | `shouldApplyTranslation`, `translationFailureKey` |
| `web_ui/src/components/translation_error.test.js` | stale-result rule, failure mapping, catalogue parity |
| `web_ui/src/components/blocks_editor.vue` | stable block identity, per-block error slot, direction label |
| `web_ui/src/views/dish_edit_view.vue` | per-field error slot, post-await check, direction label |
| `server/public/i18n/en.json`, `vi.json` | 503 copy names an admin; direction labels |

## Interfaces

```js
// web_ui/src/components/translation_error.js
export function shouldApplyTranslation({ currentSource, requestSource, currentTarget }) // boolean
export function translationFailureKey(status) // 'edit.translate.notConfigured' | '.unreachable' | '.failed'
export function translationFailureFor(id, ids, status) // the key, or null when the block is gone
```

- `shouldApplyTranslation` is true only when the field still holds the text that was sent and the target is still blank.
- Block errors live in `translateErrors[blockId] = { reason, direction }`; block ids are kept in `blockIds`, parallel to `modelValue`, spliced with move/remove.
- Field errors live in `translateErrors[field] = reason`.

## Tasks

- [x] Task 1: failing tests for `shouldApplyTranslation` (older request loses to newer source, to user-typed target, to whitespace target), `translationFailureKey` and `translationFailureFor`; 6 red, then green.
- [x] Task 2: use the helper in both editors; report a failure only while the block id still exists.
- [x] Task 3: key error slots by field/block id, label the direction, move the alerts next to their field. `translateBlock` now writes the result at the block's current index, so a block moved during the request still gets its text.
- [x] Task 4: rewrite the 503 copy; add parity tests for the full catalogs and both direction labels.

## Verification

- `cd web_ui; npx vitest run` → 68 tests pass (was 59).
- `cd web_ui; npm run build` → build green; `server/web_ui/` regenerated and committed.
- No UI test dependency added; the stale rule and the failure mapping are pure functions with unit tests.

## Shortcut limits

- `shortcut: block ids rebuild when the parent replaces the block list with a different length, upgrade if a second surface edits the same list without going through the editor`.

## Final state

- Files: `web_ui/src/components/translation_error.js`, `translation_error.test.js`, `blocks_editor.vue`, `dish_edit_view.vue`, `server/public/i18n/en.json`, `vi.json`, regenerated `server/web_ui/`, this document.
- Skipped: component-level tests (no test dependency); manual browser run of the error slot.

