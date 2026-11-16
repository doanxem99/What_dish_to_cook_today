# Architecture

## Runtime picture

```
Browser ──HTTP──> Express (server/, port 3000)
                    ├── /            static Flutter build (server/web)
                    ├── /web         same static build
                    ├── /public      uploaded images (server/public)
                    ├── /api/...     JSON API (server/routes/api)
                    └── /worker      WebSocket endpoint for the .NET worker
                          │
                          ├──> MongoDB  localhost:27017, db what_dish_to_cook_today
                          └──> spawns database_control_center.exe when a job is queued

Vue app (web_ui/, dev on 5173) ──HTTP + cookie──> same Express API
```

MongoDB is the only database. There is no MySQL code in this repository, although the old
README mentioned MySQL.

## Request lifecycle in server/

1. `server/app.js` — creates the app, CORS allowlist, body parsers, busboy (5 MB upload limit),
   static folders, routers, the `/worker` WebSocket, and the final 404/error router.
   It also stops the process from crashing when `JWT_SECRET` is absent (random secret + warning).
2. `server/routes/api/*.js` — Express routers, mounted per feature:
   `auth`, `ingredient`, `dish`, `template`, `gallery_upload`.
3. `server/config/database/connection.js` — one Mongoose connection and every schema.
   Models are exported as `database.collections.<Name>`.
4. `server/config/worker/` — the job queue (`database_worker_job` collection) and the WebSocket
   protocol with the .NET worker.
5. `server/config/file/file_action.js` — moves uploaded files from `public/gallery/temporary/`
   into their final folder and rewrites the paths inside the JSON payload.
   `resolveInside(root, relativePath)` is the guard that keeps request-driven paths inside the
   repository; every move path goes through it.
6. `server/config/debug/app_debug.js` — appends to `server/config/debug/data/data_debug.txt`.
7. `server/config/template/*.js` — JSON templates for the editor (dish, ingredient, image block).

## Authentication

- Signup hashes with bcrypt (cost 10), assigns the `user` role (created on first signup).
- Signin signs a JWT `{id}` valid 24 h with `process.env.JWT_SECRET` and sets it as the
  `token` cookie (`httpOnly`, `sameSite=lax`, `secure` only on HTTPS). The token is also
  returned in the body for non-browser clients.
- `routes/api/verifyToken.js` reads the cookie, verifies it, loads the user and roles,
  then sets `req.body.userid` and `req.roles`. Routes that need a user put `verifyToken`
  in the middleware chain; they must not trust a user id from the body.
- `POST /api/auth/signout` clears the cookie.

## Worker protocol

The server spawns `database_control_center.exe` when no worker is connected
(`server/config/worker/database_worker.js`). The worker connects to `ws://localhost:3000/worker`.

Messages are JSON:

| Direction | Shape | Meaning |
|---|---|---|
| worker → server | `{workerType:0, messageCode:0, messageData:null}` | Register |
| worker → server | `{workerType:0, messageCode:1, messageData:0\|1}` | Status reply: 0 idle, 1 working |
| server → worker | `{messageCode:0}` | Status request |

Jobs are documents in `database_worker_job`: `{data, time_request}`.
`data` is a colon-separated command: `ResetData` or `VoteBestPostIngredient:<ingredientId>`.
The worker polls the collection every second, runs the command, and deletes the job only when it
succeeded; failed jobs stay for a retry after a 10 s pause.

`database_control_center/MainForm` has a text box that inserts new jobs, which is how an admin
triggers a data reset without the API.

## Clients

### Vue (`web_ui/`)

- Entry `src/main.js`; routes `src/router/index.js`; global styles `src/assets/css/`.
- API calls are thin wrappers in `src/assets/js/*_server_action.js`, all using
  `server_info.js` for the base URL (`VITE_SERVER_URL`, default `http://localhost:3000/`).
- Auth state lives in the Pinia store `src/assets/store/auth_store.js`. The API token is an
  httpOnly cookie, so the client only stores the display user (`user` cookie) and asks the
  server for anything protected.
- Editor screens: `dish_edit_view.vue` / `ingredient_edit_view.vue` and the components under
  `src/components/edit_box/` and `src/components/display_block/`.

### Flutter (`flutter_web_dev/`)

- `lib/main.dart` sets routes: `/home`, `/dish_selection`, `/dish_detail`.
- Pages hold all network code; `lib/storages/app_storage.dart` holds the API base URL.
- Data classes parse the API envelopes in `lib/classes/data/`.
- `flutter build web`, then copy `build/web/*` over `server/web/` to update what the API serves.

## C# data tools

- `database_control_center/Workspace/` polls jobs and runs `ResetData` (drops and re-seeds
  ingredient/dish collections) and `IngredientVoteBestPost` (marks the highest-point post as
  the best post).
- `db_control/` is the offline version: `--init_data` seeds roles/users-independent collections;
  `--update_ingredient_vote_best_post <id>` runs the same vote logic once.
- Both write to the same MongoDB database. Keep them in sync when you change a seed or a job.

## Startup order

1. MongoDB running on `localhost:27017` (override with `MONGODB_URI`).
2. An admin user `moonshine@gmail.com` must exist before `db_control --init_data`
   (the seeds reference it).
3. `cd server && npm start`.
4. Optional: `cd web_ui && npm run dev` for the Vue client.
