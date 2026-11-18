# Content audit fixes (server side)

Implements the server findings of the second whole-branch review on `feat/admin-operations`
(HEAD `cbeffde`). `web_ui/src/**` and the i18n JSON belong to another agent.

## Goal

The content audit log records what happened: a post edit says `edit`, a failed write is visible
in the debug log, every detail is capped, and a corrupt or deleted target cannot break the page.

## Files

| File | Change |
|---|---|
| `server/routes/api/dish_profile.js` | Edit branch logs `dish_post.edit`; `auditContent` caps the detail at 80 characters and logs a failed write; no `req.body.userid` actor fallback; the deleted comment detail is prefixed `comment: ` |
| `server/routes/api/ingredient_profile.js` | Same, with `ingredient_post.edit` |
| `server/routes/api/admin.js` | `postTargetLabels` filters parent and user ids to valid ObjectIds before the `$in` reads |
| `server/test/audit_content.test.js` | Edit action, capped and prefixed comment detail, failed audit write, deleted parent |
| `docs/API.md` | Action list holds the two edit actions |
| `docs/KNOWN_ISSUES.md` | The `comment: ` prefix is noted |

## Interfaces

- `auditContent(req, action, targetType, targetId, detail)` keeps its signature. It stores
  `auditDetail(detail)`: whitespace collapsed, trimmed, cut at 80 characters plus `...`.
- `auditContent` never rejects. A failed write is logged as
  `appDebug.writeLine(appDebug.DebugType.Exception, "Audit write failed : " + err)`.
- `excerptOf(value): string` still exists, now returns `comment: <text>`; the 80 character cap
  comes from `auditDetail`, so the prefix counts toward it.

## Verification

```bash
cd server; npm test
```

Expected: 145 existing tests plus 4 new, 0 failures.

## Result

`cd server; npm test` → 149 tests, 149 pass, 0 fail. Four new tests: dish post edit action,
ingredient post edit action, a failed audit write still answers 200, and a post whose parent is
deleted or corrupt falls back to the post name. `docs/API.md` carries `dish_post.edit` and
`ingredient_post.edit`.

## Accepted risks

- The cap lives in the two `auditContent` copies, not in `recordAudit`; admin rows keep their
  full detail. The files are known near-duplicates (KNOWN_ISSUES 11) and must change together.
- A failure of the audit write is visible only in the debug log; the API still answers 200 by
  design.
