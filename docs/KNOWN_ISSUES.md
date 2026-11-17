# Known issues and deliberate gaps

State after the audit, cleanup and backend-foundations pass. Each item names the failing case so it
can be picked up without re-reading the codebase.

## Correctness

1. **Flutter display blocks are parsed but never drawn.** 
   `flutter_web_dev/lib/classes/data/dish_detail.dart` fills `displayBlocks`, but
   `dish_detail_page.dart` renders only name, short detail and ingredients. A dish with
   paragraphs and images shows none of them. Add a widget that walks `displayBlocks`.
2. **Comments have a backend but no working UI yet.**
   `web_ui/src/components/comment_section.vue` is still a textarea with two dead buttons; the API
   routes exist (`GET/POST/DELETE /api/dish/profile/comment*`). Plan 2 of the UI design wires it.
3. **Votes have a backend but no UI yet.** `POST /api/dish/profile/vote/:dish_post_id` exists;
   nothing in either client calls it. Plan 2 adds the control to dish detail.
4. **Search box in the Vue navbar is still decorative.**
   `web_ui/src/components/navbar.vue` has an input with no model or handler, although
   `dish_server_action.searchDish` and the server routes now work. Plan 2 wires it.
5. **Views count every read.** `getDishPostDetail` increments `views` even when the page is the
   editor loading the same post, so editing inflates views.

## Risks

6. **No rate limit or lockout on signin.**
   `server/routes/api/auth.js` compares passwords directly; a script can try unlimited
   combinations. Add per-IP throttling (for example `express-rate-limit`) before any public deploy.
7. **Regex search on user text.** Keywords are escaped now, but `$regex` without an index is a
   full collection scan. Fine for the seeded size; add a text index if the catalog grows.
8. **Auth and the create routes still have no test.** `server/test/file_action.test.js` guards
    the path helper and `ingredient_profile.routes.test.js` guards the removed PATCH endpoint;
    nothing fails when `verifyToken` stops overwriting `req.body.userid`, or when a create route
    loses its middleware. Add a token test with a stubbed user collection.
9. **Both seed tools are hand-written and diverge.** `db_control/InitData.cs` seeds 9
    ingredients; `database_control_center/Workspace/Reset/ResetData.cs` seeds 6. A change in one
    never reaches the other. Consider one seed implementation called by both.
10. **Git history still contains build output.** The index is clean and `bin/`, `obj/`, `.vs/`,
    `.cxx/` are ignored, but old commits still carry hundreds of megabytes. Use
    `git filter-repo` if the repository must shrink.

## Lean

11. **Duplicate templates.** `server/config/template/template_dish.js` and
    `template_ingredient.js` are near-copies; so are `dish_profile.js` and
    `ingredient_profile.js`. They must change together today.
12. **Reserved fields that nothing uses:** `ingredient.is_need_update`,
    `dish.is_need_update`, `WorkerStatus` in the worker module, and `role.description`.
13. **`web_ui/src/views/homemade_dishes_view.vue`, `about_view.vue`, `profile_view.vue` are
    placeholders** ("Hello", "About"). They are linked from the header, so users can reach an
    empty page.

## Deployment notes

14. **CORS allows localhost only by default.** Set `CORS_ORIGINS` (comma separated) for any real
    domain, otherwise the browser client is blocked.
15. **The server spawns the worker from a Debug build path.** Set `DATABASE_WORKER_EXE` to the
    Release executable, or the API logs "Cannot start database worker" and jobs stay queued.
16. **Port 3000 is hardcoded** in `server/app.js`; there is no `PORT` variable yet.
17. **The old JWT secret is in git history.** Commit `f3738d6` contains
    `JWT_SECRET = 'what-dish-to-cook-today'`. Anyone with a clone can forge tokens if a
    deployment reuses that value. Generate a fresh random secret; never restore the old one.
    History is not rewritten here.
