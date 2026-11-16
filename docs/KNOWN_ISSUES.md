# Known issues and deliberate gaps

State after the audit and cleanup pass. Nothing here is fixed yet; each item names the file and
the failing case so it can be picked up without re-reading the codebase.

## Correctness

1. **Flutter display blocks are parsed but never drawn.** 
   `flutter_web_dev/lib/classes/data/dish_detail.dart` fills `displayBlocks`, but
   `dish_detail_page.dart` renders only name, short detail and ingredients. A dish with
   paragraphs and images shows none of them. Add a widget that walks `displayBlocks`.
2. **The Flutter build served by the API is stale.** `server/web/` is a 2022 build.
   After changing `flutter_web_dev/lib`, run `flutter build web` and copy `build/web/*`
   into `server/web/`. Until then, `/` serves the old behaviour even though the source is fixed.
3. **Flutter deep links break on refresh.** `setPathUrlStrategy()` plus Express
   `GET /web/:page` → redirect `/` means F5 on a dish page returns home. Either drop the path
   strategy (hash URLs) or serve `web/index.html` for unknown `/web/*` paths.
4. **No vote endpoint.** `points` is only ever written as 0. The
   `VoteBestPostIngredient` job ranks posts by points, but nothing increments them, so the
   "best post" never changes after seeding. Needs a vote route plus a "one vote per user" rule.
5. **Comments are a stub.** `web_ui/src/components/comment_section.vue` has a textarea and
   buttons with no handlers; `dish_post.comments` is a raw number with no collection behind it.
6. **Search box in the Vue navbar is decorative.**
   `web_ui/src/components/navbar.vue` has an input with no model or handler.
   `dish_server_action.searchDish` exists but nothing calls it.
7. **Views count every read.** `getDishPostDetail` increments `views` even when the page is the
   editor loading the same post, so editing inflates views.

## Risks

8. **No rate limit or lockout on signin.**
   `server/routes/api/auth.js` compares passwords directly; a script can try unlimited
   combinations. Add per-IP throttling (for example `express-rate-limit`) before any public deploy.
9. **Regex search on user text.** Keywords are escaped now, but `$regex` without an index is a
   full collection scan. Fine for the seeded size; add a text index if the catalog grows.
10. **No test covers auth or the API routes.** Only `server/test/file_action.test.js` (path
    guard) and the Flutter parser tests exist. The token middleware, signup and post-creation
    rules have no test that fails when they break.
11. **Both seed tools are hand-written and diverge.** `db_control/InitData.cs` seeds 9
    ingredients; `database_control_center/Workspace/Reset/ResetData.cs` seeds 6. A change in one
    never reaches the other. Consider one seed implementation called by both.
12. **Git history still contains build output.** The index is clean and `bin/`, `obj/`, `.vs/`,
    `.cxx/` are ignored, but old commits still carry hundreds of megabytes. Use
    `git filter-repo` if the repository must shrink.

## Lean

13. **Duplicate templates.** `server/config/template/template_dish.js` and
    `template_ingredient.js` are near-copies; so are `dish_profile.js` and
    `ingredient_profile.js`. They must change together today.
14. **Reserved fields that nothing uses:** `ingredient.is_need_update`,
    `dish.is_need_update`, `WorkerStatus` in the worker module, and `role.description`.
15. **`web_ui/src/views/homemade_dishes_view.vue`, `about_view.vue`, `profile_view.vue` are
    placeholders** ("Hello", "About"). They are linked from the header, so users can reach an
    empty page.

## Deployment notes

16. **CORS allows localhost only by default.** Set `CORS_ORIGINS` (comma separated) for any real
    domain, otherwise the browser client is blocked.
17. **The server spawns the worker from a Debug build path.** Set `DATABASE_WORKER_EXE` to the
    Release executable, or the API logs "Cannot start database worker" and jobs stay queued.
18. **Port 3000 is hardcoded** in `server/app.js`; there is no `PORT` variable yet.
