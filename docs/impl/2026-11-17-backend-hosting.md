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

- Task 1: complete. Test RED (filter lacked `name_vi`) then GREEN; suite 4/4. Review: no Critical, one Important (assertions read the mock, not the response); fixed by strengthening the test and proving it fails when `name_vi` leaves the projection; suite 5/5. Commit `27e5c0e`, test fix `6c574d6`.
- Ledgered minor (review 1): `dish_search.js` returns `short_detail` as an omitted key instead of `null` when a post has no short detail; clients treat both as falsy.
- Task 2: complete. RED (404/HTML), GREEN; suite 7/7. Review: no Critical, no Important; verdict merge. Commit `8f43931`.
- Ledgered minors (review 2): add a whitelist assertion that `/me` never gains extra keys; drop the dead `.populate('roles')` on the `/me` query; the 404 branch is unreachable but harmless.
- Task 3: complete. 5 tests RED then GREEN; then 2 more for missing-post 404 and concurrent-delete 404. Review: no Critical, two Important (concurrent delete double-decrement; create for a missing post persisted a comment then 500). Both fixed atomically with tests; suite 14/14. Commits `12d78c9`, `c7c46fc`, `1a62581`.
- Ledgered minors (review 3): index `comment.dish_post_id` for the list query; filter invalid user ids before the username join; two-element fixture to prove sort order.
- Task 4: complete. 4 tests RED then GREEN; review found a Critical (concurrent unvote double-decrements `points`, can go negative) and two Important (concurrent first vote answered 500; tests did not assert the counter). Fixed with `findOneAndDelete`, duplicate-key handling, and a floored atomic decrement; tests now assert real counter values and the zero floor; suite 18/18, then 19/19. Commits `753e012`, fixes with this entry.
- Ledgered minor (review 4): a `CastError` from an invalid id answers 500 instead of 404; `ResetData` drops `dish_post` but not `vote`, so orphan votes accumulate after a reseed (pick up in Task 8).
- Task 5: complete. 3 tests RED then GREEN; review asked for cap, sort and empty assertions; strengthened, then an amend after a red first attempt (below); suite 23/23. Commit `0448f85`.
- Ruling: committed `test: pin the mine list sort...` once while its empty-case assertion was red, because the stub captured the array by value; fixed the stub and amended, leaving one green commit. Cost if wrong: none now, but the ledger records the slip.
- Ledgered minor (review 5): misplaced `// Comments on a dish post` label above `/mine`; no `{user_id, date_time}` index; `type` can be absent where `name_vi` is null; the 50 cap has no `has_more` for clients.
- Task 6: complete. 1 test RED then GREEN, second test added; review found one Important (posts with no `user_id` were listed as homemade) and one latent (ObjectId-typed author). Fixed with `$exists`, a JS guard, and a two-post fixture; suite 25/25. Commits `ac4fe6d`, `bd3302e`.
- Ledgered minor (review 6): homemade has no ordering beyond `limit(10)`; admin-missing test does not assert the query was skipped; `server.close()` not awaited in the tests.
- Next: Task 7 (hosting) — biggest step, touches `server/app.js`, Vite output, both builds, and commits `server/web_ui`.

- Task 7: complete. 4 hosting tests RED then GREEN; review found two Important (fallback answered missing assets with 200 HTML; `/web` stranded old links) and one structural (Flutter fallback unnecessary). Fixed: HTML-only fallback with an extension guard, `/web` → 301 `/flutter/`. Re-graded the fallback removal request: `main.dart` calls `setPathUrlStrategy()`, so the Flutter shell must be served for HTML deep links; kept a guarded fallback with a test. Rebuilt Vue into `server/web_ui` and Flutter with `--base-href /flutter/`; live check: `/` Vue, `/flutter/` assets, `/api/missing` 404 text, missing asset 404, `/web` 301. Suite 32/32, then 33/33. Commits `32c6507`, `39abca2`.
- Task 8: complete. Bilingual `name_vi` for all seeded ingredients, `name_vi`/`short_detail_vi` for the seeded dish and first block `text_vi`; both seeds drop `vote` (and later `comment`) on reseed. Both `dotnet build` succeed. Commit `95e91db`.
- Ruling: seed body copy is partially translated — names, short details and the first paragraph carry Vietnamese; the remaining blocks fall back to English. Cost if wrong: a mixed-language sample detail page until plan 3 or the owner supplies the rest.
- Ruling: a `Get-Content`/`Set-Content` round trip in Task 8 mangled Vietnamese text in `ResetData.cs`; the file was restored from git and every later edit used the edit tool. Cost if wrong: none, the corrupted version never left the working tree; recorded so the next session avoids the same command.
- Task 9: complete. API, data model, architecture, known issues and README/AGENTS updated for the new endpoints and hosting. Suite 33/33; Vue build, Flutter tests 4/4, both .NET builds green. Commit `4e3c36d`.
- Final whole-branch review (fresh subagent, `ac4fe1e..4e3c36d`): no Critical; three Important — comment counter had no floor, reseed left comments pointing at dead posts, four docs still described the old hosting/data model. All three fixed with a RED→GREEN counter test, two one-line drops, and doc corrections; suite 33/33, both .NET builds green. Commit `c1fec78`.
- Ledgered minors (final review): `/mine` omits `short_detail_vi`; `/web/<suffix>` redirects to `/flutter/` and drops the suffix; hosting tests cover the factory but not `app.js` mount order; a missing `server/web_ui` answers 500 with no hint.

## Final state

- Branch `feat/backend-foundations`, cut from `chore/repo-hygiene`; not pushed. PR base decision is deferred until PR #1 merges.
- Suites: server 33/33, Flutter 4/4, Vue build green, both .NET builds green.
- Delivered: bilingual fields and search, `/auth/me` + `created_at`, comments, votes, my-posts, homemade, Vue at `/` and Flutter at `/flutter`, bilingual seeds, docs.
- Next: plan 2 (Vue UI, direction round first).



