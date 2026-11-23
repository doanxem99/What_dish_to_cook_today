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

## Vue UI gaps (plan 2, current state)

- **One catalog, no split left.** The older note about the C# tools holding a small catalog is
  gone: `catalog/*.json` feeds the server reset and both .NET tools. The count is 38 ingredients
  and 13 dishes everywhere.

- **Editor screens are still on the old styling and have no Vietnamese fields.**
  `dish_edit_view.vue`, `ingredient_edit_view.vue`, the generate dialogs and `edit_box` predate the
  new system; they cannot set `name_vi`/`short_detail_vi`, so a dish created there falls back to
  English. Next increment of plan 2. Entry links now exist from dish and ingredient detail.
- **The display face is not self-hosted.** `theme.css` asks for `Be Vietnam Pro` and falls back to
  the system sans; the woff2 needs adding before the typography matches the direction.
- **No "used in" list on ingredient detail.** It needs an endpoint that answers which dishes include
  the ingredient; deferred rather than faked.
- **Votes are not reflected on the board.** `get_best_dish_post` and selection previews rank by
  `points`, but the UI shows the count only on detail.

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
9. **One seed path, three callers.** `catalog/*.json` plus `shared/Catalog.cs` and
    `shared/DatabaseSeed.cs` feed `db_control init`, the offline console and the admin reset, so
    a new field reaches all three. The remaining risk is a stale binary: an older `db_control`
    build still writes its own short list. Rebuild the tools after changing the catalog.
10. **Git history still contains build output.** The index is clean and `bin/`, `obj/`, `.vs/`,
    `.cxx/` are ignored, but old commits still carry hundreds of megabytes. Use
    `git filter-repo` if the repository must shrink.

- **`audit_log` has no TTL.** Every successful content create appends a row, so the collection
  grows with content; retention is a later task.
- **A deleted comment's audit detail is not a live body.** The row stores `comment: <excerpt>`
  capped at 80 characters plus an ellipsis, because the comment is deleted before the row is
  read. The `comment: ` prefix is the only thing that separates it from a live body; the audit
  page shows it as the target label.

## Lean

11. **Duplicate templates.** `server/config/template/template_dish.js` and
    `template_ingredient.js` are near-copies; so are `dish_profile.js` and
    `ingredient_profile.js`. They must change together today.
12. **Reserved fields that nothing uses:** `ingredient.is_need_update`,
    `dish.is_need_update`, the legacy AI metric columns on `admin_job`, and `role.description`.
13. **`web_ui/src/views/homemade_dishes_view.vue`, `about_view.vue`, `profile_view.vue` are
    placeholders** ("Hello", "About"). They are linked from the header, so users can reach an
    empty page.

## AI assistant

24. **No real-key provider test has run.** Every suite stubs the provider; `node
    server/scripts/ai-check.mjs` reports `skipped: no key` without `OPENCODE_API_KEY`. Live
    tool calling against the default base URL is therefore unverified. Run the check once with
    the intended key before launch.
25. **Flutter's assistant is read-first.** The Ask sheet, inferred goal label with override,
    streaming, stop, citations, capability, quota and history exist. Two gaps remain: the
    `select_ingredients` and `start_draft` action cards are not rendered (the server can return
    them; the cook sees no confirm button), and the sheet has no widget test because the surface
    is driven by live streams. Both are Vue-parity items, not server changes.
26. **Quota is a UTC day.** `getQuotaStatus` resets at 00:00 UTC, not local midnight, and the
    UI shows the UTC reset time. A user east or west of UTC sees the limit reset mid-day or
    mid-evening.
27. **Cosine retrieval runs in the Node process.** `retrievePassages` loads every
    `ai_embedding` row and scores it in memory; a `shortcut:` note marks the ~20k-row point to
    move to a vector index. The seeded catalog plus docs is far below that, but a large comment
    corpus would raise latency and RAM.
28. **`bge-m3` needs a few GB of RAM.** Compose runs it next to MongoDB and the server on the
    same host. Without enough memory the embedding calls fail, answers fall back to tool-only
    retrieval, and the stream reports `embed_down`.

## Deployment notes

14. **CORS needs the real origins listed.** The server accepts only origins in `CORS_ORIGINS`
    (comma separated). The site's own public origin must be there, because built Vue assets send
    an `Origin` header even from the same host; anything unlisted gets 403 on the API and on asset
    requests, which looks like a blank page. Behind a TLS proxy also set `TRUST_PROXY=1`.
15. **`public/gallery` is a volume in Compose, not a copy.** Existing uploads in a local
    `server/public/gallery` are not carried into the `gallery` volume. Copy them in or restore a
    backup before switching a live install to Compose.
16. **Port 3000 is fixed inside the server.** `server/app.js` listens on 3000, and Compose
    publishes `3000:3000`. Changing the host port is fine; add the new origin to
    `CORS_ORIGINS` at the same time. There is no `PORT` variable.
17. **The old JWT secret is in git history.** Commit `f3738d6` contains
    `JWT_SECRET = 'what-dish-to-cook-today'`. Anyone with a clone can forge tokens if a
    deployment reuses that value. Generate a fresh random secret; never restore the old one.
    History is not rewritten here.
18. **`must_change_password` is enforced by the client guard only.** `verifyToken` rejects a
    disabled account with 401, but it does not refuse a session that only needs a password
    change. The server reports the flag at signin and `/api/auth/me` and clears it on
    `POST /api/auth/password`; other API calls still work. A script that keeps the temporary
    password can use the account. Enforce the flag in `verifyToken` if that matters.
19. **The Vite dev server cannot serve `/public/i18n/*.json`.** Those catalogs live in
    `server/public`, and `/public` belongs to Express, so `npm run dev` renders interface keys
    instead of translations unless a proxy or a copied folder supplies them. The build served by
    Express at `/` is correct.

## Responsive layout

20. **No automated guard for layout.** The 320-1440 px pass was verified with a temporary probe harness that measured header height, overflow and tap targets, then was deleted. Any CSS change can regress it silently; repeat the probe or add a Playwright-style check before touching theme.css media queries.

## Flutter client

21. **Flutter editors are new and lightly exercised.** Phase 3 adds dish and ingredient create/edit, uploads, drag-and-drop, blocks and the translation toggle. The file picker and drag-and-drop were not exercised in a real browser; only unit and widget tests cover the upload path.
22. **Flutter layout is untested in a real browser.** The build is served at /flutter/ and all widget tests pass, but no browser render was captured for this pass. Check /flutter/ at 320 px and 1440 px before claiming parity.

## Data tools

23. **The C# catalog reader mirrors a JSON shape the server does not validate strictly.**
    `shared/Catalog.cs` and `server/config/catalog/validate.js` both read `catalog/*.json`.
    `POST /api/admin/reset` loads and validates the catalog before it sets maintenance or drops
    a collection, but `shared/Catalog.cs` still fails on its own parse. A malformed file still
    fails the C# tools before they write.
