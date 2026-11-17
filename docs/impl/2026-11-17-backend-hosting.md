# Implementation record: backend and hosting foundations

- **Goal:** add bilingual catalog fields, comments, votes, my-posts, homemade and `/auth/me`, and serve Vue at `/` with Flutter at `/flutter`, without breaking existing clients.
- **Plan:** [docs/superpowers/plans/2026-11-17-backend-hosting.md](../superpowers/plans/2026-11-17-backend-hosting.md)
- **Spec:** [docs/superpowers/specs/2026-11-17-ui-completion-design.md](../superpowers/specs/2026-11-17-ui-completion-design.md)
- **Branch:** `feat/backend-foundations`, cut from `chore/repo-hygiene` because the auth and hosting fixes it builds on are still in PR #1.

## Files and responsibilities

| File | Responsibility |
|---|---|
| `server/config/database/connection.js` | `_vi` fields, `created_at`, `comment`, `vote` + unique index |
| `server/routes/api/dish_search.js`, `ingredient_search.js` | dual-language regex search |
| `server/routes/api/dish_selection.js` | preview fields and `/homemade` |
| `server/routes/api/dish_profile.js` | comments, votes, `/mine` |
| `server/routes/api/ingredient_profile.js` | `/mine` |
| `server/routes/api/auth.js` | `GET /me`, `created_at` at signup |
| `server/app.js`, `server/routes/web/*` | Vue at `/`, Flutter at `/flutter`, SPA fallback |
| `web_ui/vite.config.mjs`, `web_ui/src/assets/js/server_info.js` | build to `server/web_ui`, same-origin API |
| C# seed tools | Vietnamese seed values |

## Interfaces

Copied from the plan; the plan is authoritative:

- `GET/POST/DELETE /api/dish/profile/comments|comment/...` with `{status, status_code, data}`.
- `POST /api/dish/profile/vote/:dish_post_id` → `data:{voted, points}`.
- `GET /api/dish/profile/mine`, `GET /api/ingredient/profile/mine`.
- `GET /api/dish/selection/homemade` → `{isSuccess, data}`.
- `GET /api/auth/me` → `{message, user:{id, username, email, created_at, roles}}`.
- Preview items gain `name_vi`, `short_detail_vi`.

## Task checklist

- [ ] 1. Bilingual fields and dual-language search (test: `server/test/bilingual_search.test.js`)
- [ ] 2. `created_at` and `/api/auth/me` (test: `server/test/auth_me.test.js`)
- [ ] 3. Comments (test: `server/test/comments.test.js`)
- [ ] 4. Votes (test: `server/test/votes.test.js`)
- [ ] 5. Mine endpoints (test: `server/test/mine.test.js`)
- [ ] 6. Homemade (test: `server/test/homemade.test.js`)
- [ ] 7. Hosting (test: `server/test/hosting.test.js`)
- [ ] 8. Bilingual seeds (build check)
- [ ] 9. Docs

## Verification commands

```
cd server && npm test                                  -> all tests pass
cd web_ui && npm run build                             -> built
cd flutter_web_dev && flutter test                     -> 4 pass
flutter build web --base-href /flutter/                -> built
dotnet build both projects                             -> Build succeeded
```

## Accepted risks and shortcuts

- `shortcut: stacked branch`, upgrade when PR #1 merges: rebase onto `main` and retarget the PR base.
- `shortcut: no live MongoDB`, upgrade when a database is available: route tests stub the connection, so query semantics are asserted on filters, not on real Mongo behaviour. The unique vote index is only exercised in production.
- `shortcut: Flutter served build`, upgrade if the committed `server/web` must stay small: both served builds are tracked because Express serves them.

## Rulings

- Ruling: cut from `chore/repo-hygiene`, not `main`, because this plan relies on the auth and upload fixes in PR #1. Cost if wrong: PR #2 shows PR #1's commits until #1 merges.
- Ruling: per-task review uses a fresh subagent on each task's commit range, only Critical/Important are fixed inline, Minors go to this record. Cost if wrong: a slice reviewer misses cross-task effects; the final branch review covers that.

## Progress log
