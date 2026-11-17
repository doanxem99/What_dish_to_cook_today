# Backend and hosting foundations — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the bilingual catalog fields, comments, votes, my-posts, homemade and `/auth/me` endpoints that the two clients need, and serve Vue at `/` with Flutter at `/flutter`, without breaking anything that works today.

**Architecture:** Additive Express routes under the existing mounts, three new Mongoose models, one new optional field on user, and a hosting switch in `server/app.js`. Every changed response keeps its current fields and adds new ones, so the current Vue and Flutter builds keep working during the transition.

**Tech Stack:** Node 22, Express 4, Mongoose 6, node:test, Flutter 3.32 (build only), .NET 9 (seed edits).

**Spec:** `docs/superpowers/specs/2026-11-17-ui-completion-design.md`

## Global Constraints

- Additive only: no existing route path, field name, or response field is removed or renamed in this plan.
- No new runtime dependency.
- Tests use the existing pattern: stub `server/config/database/connection` in `require.cache`, mount the router on a bare Express app, call it with `fetch`. No MongoDB needed.
- Response envelopes stay consistent with their neighbourhood: `{status, status_code, data}` for profile routes, `{isSuccess, data}` for selection routes.
- Vietnamese fields are optional; empty or missing means the client falls back to English.
- `dish_post.points` stays the stored counter, updated together with the `vote` collection.
- Express serves Vue at `/` and Flutter at `/flutter`; API and `/public` keep priority over the SPA fallback.
- Node floor stays `>=22.9`.

## Review Focus

1. A vote toggle must be idempotent per user and must not drift `points` when called twice.
2. Deleting a comment must reject a non-owner with 403, not 404 and not success.
3. The SPA fallback must not swallow `/api/*`, `/public/*` or `/worker`.
4. Search must match a Vietnamese name when the English name does not contain the term.
5. Serving Flutter under `/flutter` depends on a rebuilt asset base href; the old build must not be served there.

---

### Task 1: Bilingual catalog fields and search

**Files:**
- Modify: `server/config/database/connection.js` (schemas for `dish`, `ingredient`, `dish_post`, `ingredient_post`)
- Modify: `server/routes/api/dish_search.js`, `server/routes/api/ingredient_search.js`
- Modify: `server/routes/api/dish_selection.js`, `server/routes/api/ingredient_selection.js` (return `name_vi`, `short_detail_vi`)
- Test: `server/test/bilingual_search.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: optional String fields `name_vi`, `short_detail_vi` on the four models; every search and selection preview item gains `name_vi` and `short_detail_vi` (may be `null`).

- [ ] **Step 1: Write the failing test**

```js
// server/test/bilingual_search.test.js
const test = require('node:test');
const assert = require('node:assert');
const connectionPath = require.resolve('../config/database/connection');
const call = { find: null };
require.cache[connectionPath] = {
    id: connectionPath, filename: connectionPath, loaded: true,
    exports: { mongoose: {}, collections: {
        Dish: { find(filter, fields) { call.find = { filter, fields }; return { limit: async () => [
            { _id: 'a', name: 'Beef stew', name_vi: 'Bò hầm' }
        ] }; } },
        DishPost: { find: async () => [] },
    } }
};
const router = require('../routes/api/dish_search');

test('dish search matches the Vietnamese name too', async () => {
    const express = require('express');
    const app = express();
    app.use('/api/dish/search', router);
    const server = app.listen(0);
    await require('node:events').once(server, 'listening');
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/dish/search/keyword/b%C3%B2`);
        assert.strictEqual(res.status, 200);
        assert.match(JSON.stringify(call.find.filter), /name_vi/);
    } finally {
        server.close();
    }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd server && node --test test/bilingual_search.test.js`
Expected: FAIL, the filter has no `name_vi`.

- [ ] **Step 3: Add the fields and the `$or` filter**

Add to each of the four schemas: `name_vi: String` and, where `short_detail` exists, `short_detail_vi: String`. In both search modules build the filter as `{ $or: [ { name: re }, { name_vi: re } ], best_post_id: { $exists: true, $ne: "" } }` with the same escaped regex, and include `name_vi short_detail_vi` in the selected fields and in the returned preview objects.

- [ ] **Step 4: Run the test, then the suite**

Run: `cd server && node --test test/bilingual_search.test.js && npm test`
Expected: PASS, then `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/config/database/connection.js server/routes/api/dish_search.js server/routes/api/ingredient_search.js server/routes/api/dish_selection.js server/routes/api/ingredient_selection.js server/test/bilingual_search.test.js
git commit -m "feat: bilingual catalog names and dual-language search"
```

---

### Task 2: `created_at` and `/api/auth/me`

**Files:**
- Modify: `server/config/database/connection.js` (`user.created_at`)
- Modify: `server/routes/api/auth.js` (set it at signup, add `GET /me`)
- Test: `server/test/auth_me.test.js`

**Interfaces:**
- Consumes: `verifyToken` (sets `req.body.userid`, `req.roles`).
- Produces: `GET /api/auth/me` → `{message, user:{id, username, email, created_at, roles}}`; `created_at` is `null` for users created before this change.

- [ ] **Step 1: Write the failing test**

Mount `auth` on a bare app with stubbed `User.findOne` returning `{_id:'u1', username:'ana', email:'a@b.c', roles:['user']}` (no `created_at`) and stubbed `Role.find` returning `[{name:'user'}]`; send a valid cookie signed with `process.env.JWT_SECRET`. Assert 200 and `body.user.created_at === null`, `body.user.username === 'ana'`.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd server && node --test test/auth_me.test.js`
Expected: FAIL, 404 because the route does not exist.

- [ ] **Step 3: Implement**

Add `created_at: Date` to the user schema; set `created_at: new Date()` in `signup`. Add:

```js
router.get('/me', verifyToken, async function(req, res){ /* look up user with roles, answer as above */ });
```

`verifyToken` already loaded the user; reuse `req.user` if you add it there, otherwise query once by `req.body.userid`.

- [ ] **Step 4: Run the test, then the suite**

Run: `cd server && node --test test/auth_me.test.js && npm test`
Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/config/database/connection.js server/routes/api/auth.js server/test/auth_me.test.js
git commit -m "feat: expose the signed-in user with /api/auth/me"
```

---

### Task 3: Comments on dish posts

**Files:**
- Modify: `server/config/database/connection.js` (new `comment` model)
- Modify: `server/routes/api/dish_profile.js` (three routes)
- Test: `server/test/comments.test.js`

**Interfaces:**
- Consumes: `verifyToken`; `DishPost`, `User`, `Comment` stubs.
- Produces:
  - `GET /api/dish/profile/comments/:dish_post_id` → `{status, status_code, data:[{id, body, user_id, username, date_time, is_mine}]}`, newest first, limit 50.
  - `POST /api/dish/profile/comment/:dish_post_id` (auth), body `{body}` → same envelope with the created comment; 400 when `body` is empty after trim or longer than 1000 characters.
  - `DELETE /api/dish/profile/comment/:comment_id` (auth) → `{status, status_code, data:{deleted:true}}`; 403 when the comment belongs to another user.

- [ ] **Step 1: Write the failing tests**

Three tests in `server/test/comments.test.js` using a stubbed connection:
1. `POST` with `{body:'  '}` and a valid cookie answers 400.
2. `POST` with a valid body answers 200 and the stubbed `create` received `user_id` from the token, not from the body.
3. `DELETE` of another user's comment answers 403.

A valid cookie helper signs `{id:'u1'}` with `process.env.JWT_SECRET`; set that env var at the top of the file.

- [ ] **Step 2: Run and watch them fail**

Run: `cd server && node --test test/comments.test.js`
Expected: three failures, 404 or missing stubs.

- [ ] **Step 3: Implement the model and routes**

Model `comment`: `{dish_post_id: String, user_id: String, body: String, date_time: Date}`. Routes as above; join usernames with one `User.find({_id:{$in:...}})` and a `Map`, the pattern used by `getBestDishPost`. `is_mine` compares to `req.body.userid`.

- [ ] **Step 4: Run the tests, then the suite**

Run: `cd server && node --test test/comments.test.js && npm test`
Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/config/database/connection.js server/routes/api/dish_profile.js server/test/comments.test.js
git commit -m "feat: add comments on dish posts"
```

---

### Task 4: Votes with one vote per user

**Files:**
- Modify: `server/config/database/connection.js` (new `vote` model with a compound unique index)
- Modify: `server/routes/api/dish_profile.js` (toggle route)
- Test: `server/test/votes.test.js`

**Interfaces:**
- Consumes: `verifyToken`, `DishPost`, `Vote`.
- Produces: `POST /api/dish/profile/vote/:dish_post_id` (auth) → `{status, status_code, data:{voted, points}}`. Calling it twice for the same user and post returns `voted:false` and the original `points`.

- [ ] **Step 1: Write the failing tests**

1. First call creates a vote and answers `{voted:true, points:1}` when the stubbed post starts at 0 and `$inc` is applied.
2. Second call answers `{voted:false, points:0}` and the stub records one delete.
3. Unauthenticated call answers 401.

Stub `Vote.findOne`, `Vote.create`, `Vote.deleteOne`, `DishPost.findByIdAndUpdate` to capture arguments.

- [ ] **Step 2: Run and watch them fail**

Run: `cd server && node --test test/votes.test.js`
Expected: FAIL, route missing.

- [ ] **Step 3: Implement**

Model `vote`: `{user_id: String, dish_post_id: String, date_time: Date}` with `schema.index({user_id:1, dish_post_id:1}, {unique:true})`. Route: look up the vote; absent → create and `$inc points: 1`; present → delete and `$inc points: -1`; read the post back and answer its `points`. Guard `points` never goes below 0 by using `$inc` only when a vote row changed.

- [ ] **Step 4: Run the tests, then the suite**

Run: `cd server && node --test test/votes.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/config/database/connection.js server/routes/api/dish_profile.js server/test/votes.test.js
git commit -m "feat: one-vote-per-user toggle for dish posts"
```

---

### Task 5: My posts on both profiles

**Files:**
- Modify: `server/routes/api/dish_profile.js`, `server/routes/api/ingredient_profile.js`
- Test: `server/test/mine.test.js`

**Interfaces:**
- Consumes: `verifyToken`, `DishPost`/`IngredientPost` with `is_best_post`, parent collections.
- Produces:
  - `GET /api/dish/profile/mine` → `{status, status_code, data:[{id, name, name_vi, short_detail, profile_image, is_best_post, date_time}]}`
  - `GET /api/ingredient/profile/mine` → same shape plus `type`.

- [ ] **Step 1: Write the failing test**

One test per route: stub `find({user_id:'u1'})` returning two posts, one `is_best_post:true`; assert both are returned and the flag survives. Assert the query used the token's user id, not a body value.

- [ ] **Step 2: Run and watch it fail**

Run: `cd server && node --test test/mine.test.js`
Expected: 404 for both.

- [ ] **Step 3: Implement**

Query posts by `user_id`, newest `date_time` first, limit 50, project the listed fields.

- [ ] **Step 4: Run and commit**

```bash
cd server && node --test test/mine.test.js && npm test
git add server/routes/api/dish_profile.js server/routes/api/ingredient_profile.js server/test/mine.test.js
git commit -m "feat: list a user's own dish and ingredient posts"
```

---

### Task 6: Homemade dishes

**Files:**
- Modify: `server/routes/api/dish_selection.js`
- Test: `server/test/homemade.test.js`

**Interfaces:**
- Consumes: `Dish`, `DishPost`, `User`.
- Produces: `GET /api/dish/selection/homemade` → `{isSuccess, data:[preview]}` where the preview shape matches `/ingredients/:ids`.

- [ ] **Step 1: Write the failing test**

Stub `User.findOne({username:'moonshine@gmail.com'})` returning `{_id:'admin'}`, `DishPost.find` capturing the filter, `Dish.find` returning one dish. Assert the captured filter excludes `user_id` values `'admin'` and `'unknow'` and includes `is_best_post: true`.

- [ ] **Step 2: Run and watch it fail**

Run: `cd server && node --test test/homemade.test.js`
Expected: 404.

- [ ] **Step 3: Implement**

Resolve the seed admin id by username, then reuse `findDishSelectionByIds`'s join with the filter `{is_best_post:true, user_id:{$nin:['unknow', adminId]}}`. If the admin user is missing, treat the list as empty rather than throwing.

- [ ] **Step 4: Run and commit**

```bash
cd server && node --test test/homemade.test.js && npm test
git add server/routes/api/dish_selection.js server/test/homemade.test.js
git commit -m "feat: list dishes contributed by users"
```

---

### Task 7: Serve Vue at `/`, Flutter at `/flutter`

**Files:**
- Modify: `server/app.js` (static mounts, SPA fallback, order)
- Modify: `server/routes/web/index.js`, `server/routes/web/error.js` (fallback instead of redirect)
- Modify: `web_ui/src/assets/js/server_info.js` (same-origin base in production)
- Modify: `web_ui/vite.config.mjs` (build output to `server/web_ui`)
- Modify: `CONTRIBUTING.md` (both served builds are tracked)
- Test: `server/test/hosting.test.js`
- Rebuild: `flutter build web --base-href /flutter/`, copy to `server/web`

**Interfaces:**
- Consumes: nothing.
- Produces: `GET /` and any non-API path → Vue `index.html` from `server/web_ui`; `GET /flutter` and `/flutter/*` → Flutter build from `server/web`; `/api`, `/public`, `/worker` untouched.

- [ ] **Step 1: Write the failing test**

Mount the static stack from a fixture directory: a temp dir with `web_ui/index.html` containing `vue-root` and `web/index.html` containing `flutter-root`. Assert `GET /` returns `vue-root`, `GET /flutter/` returns `flutter-root`, `GET /api/missing` is not answered with Vue HTML, and `GET /dishes` (a Vue client route) returns `vue-root`.

- [ ] **Step 2: Run and watch it fail**

Run: `cd server && node --test test/hosting.test.js`
Expected: `/flutter/` 404s and `/dishes` 404s.

- [ ] **Step 3: Implement the order**

In `app.js`, after the API routers: `app.use('/flutter', express.static(server/web))` plus a `/flutter/*` fallback to the Flutter index; `app.use(express.static(server/web_ui))`; then a final GET fallback that sends `web_ui/index.html` for any path not starting with `/api`, `/public`, or `/worker`. Point Vite's `build.outDir` at `../server/web_ui` and set the API base to same-origin in production builds. Remove the old `/` → Flutter mount and the `/web/:page` redirect.

- [ ] **Step 4: Verify by hand and with the suite**

```bash
cd web_ui && npm run build
cd ../flutter_web_dev && flutter build web --base-href /flutter/ && Copy-Item -Recurse -Force build/web/* ../server/web/
cd ../server && node --test test/hosting.test.js && npm test
```

Then start the server and check `GET /` (Vue), `GET /flutter/` (Flutter assets load), `GET /api/dish/selection/` (JSON). Stop it.

`server/web_ui` is committed like `server/web`, because Express serves it. Update the CONTRIBUTING exception list so both are named as tracked build output.

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/routes/web server/test/hosting.test.js web_ui/vite.config.mjs web_ui/src/assets/js/server_info.js CONTRIBUTING.md
git add server/web server/web_ui
git commit -m "feat: serve Vue at / and Flutter at /flutter"
```

---

### Task 8: Bilingual seed content

**Files:**
- Modify: `db_control/db_control/InitData.cs`
- Modify: `database_control_center/database_control_center/Workspace/Reset/ResetData.cs`

**Interfaces:**
- Consumes: the schema from Task 1.
- Produces: seeded dishes and ingredients carry `name_vi` and `short_detail_vi`; text blocks carry `text_vi`.

- [ ] **Step 1: Add the Vietnamese values**

For each seeded ingredient and the seeded dish, add `name_vi` (for example `Beef` → `Thịt bò`, `Spagetti` → `Mì Ý`) and one short Vietnamese sentence for `short_detail_vi`; add `text_vi` to each seeded text block with a Vietnamese translation of its `text`.

- [ ] **Step 2: Verify the tools still write a valid document**

```bash
dotnet build db_control/db_control/db_control.csproj
dotnet build database_control_center/database_control_center/database_control_center.csproj
```

Expected: both `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add db_control/db_control/InitData.cs database_control_center/database_control_center/Workspace/Reset/ResetData.cs
git commit -m "docs: bilingual seed content for the catalog"
```

---

### Task 9: Document the new surface

**Files:**
- Modify: `docs/API.md`, `docs/DATA_MODEL.md`, `docs/KNOWN_ISSUES.md`

- [ ] **Step 1: Update the docs**

`API.md`: the five new endpoint groups, their bodies and envelopes.
`DATA_MODEL.md`: `comment` and `vote` collections, the unique index, `user.created_at`, the `_vi` fields and the fallback rule, the homemade definition.
`KNOWN_ISSUES.md`: remove items the plan fixes (comments stub, no vote endpoint, no my-posts) and add whatever remains.

- [ ] **Step 2: Verify links and run everything**

```bash
cd server && npm test
cd ../web_ui && npm run build
cd ../flutter_web_dev && flutter test
cd .. && dotnet build db_control/db_control/db_control.csproj
```

Expected: `# fail 0`, build succeeds, 4 tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/API.md docs/DATA_MODEL.md docs/KNOWN_ISSUES.md
git commit -m "docs: record comments, votes and hosting changes"
```

---

## Out of scope

Vue screens, Flutter screens, the visual system, AI, nutrition, editor-role enforcement. Those are plans 2 and 3.

## Start order note

Tasks 1-6 are independent of Task 7; Task 7 can run in parallel by a second executor if one is available. Task 8 depends on Task 1. Task 9 runs last.
