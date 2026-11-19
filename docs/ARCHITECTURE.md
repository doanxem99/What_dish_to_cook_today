# Architecture

## Runtime picture

```
Browser --HTTP--> Express (server/, port 3000)
                    |-- /            static Vue build (server/web_ui)
                    |-- /flutter     static Flutter build (server/web)
                    |-- /public      uploaded images and i18n catalogs (server/public)
                    |-- /api/...     JSON API (server/routes/api)
                    |-- /admin       the Vue admin area (same build, guarded route)
                          |
                          +--> MongoDB  mongodb://mongo:27017/what_dish_to_cook_today (Compose)
                          +--> LibreTranslate  TRANSLATE_URL, en/vi only
                          +--> Ollama  OLLAMA_URL, local bge-m3 embeddings and optional chat
                          +--> server/backups  backup archives (Compose volume backup-data)

Vue app (web_ui/, dev on 5173) --HTTP + cookie--> same Express API
```

MongoDB is the only database. There is no worker process and no WebSocket endpoint: admin
operations run inside the server process, one job at a time.

## Deployment

`docker-compose.yml` runs four services and five volumes:

| Service | Image / build | Ports | Volumes |
|---|---|---|---|
| `mongo` | `mongo:7` | none | `mongo-data:/data/db` |
| `server` | this repository's `Dockerfile` | `3000:3000` | `backup-data:/app/backups`, `gallery:/app/public/gallery` |
| `libretranslate` | `libretranslate/libretranslate:v1.6.5` | none | `translate-models:/home/libretranslate/.local` |
| `ollama` | `ollama/ollama:latest` | none | `ollama-models:/root/.ollama` |

The `Dockerfile` has two stages. The first builds `web_ui` with Node and writes the result to
`server/web_ui` (see `web_ui/vite.config.mjs`). The second installs the server's production
dependencies, copies `server/`, drops in that build and copies the root `catalog/` to `/catalog`
because `server/config/catalog/index.js` climbs three levels from `config/catalog`. It also copies
`PRODUCT.md`, `README.md` and `docs/help/` to `/PRODUCT.md`, `/README.md` and `/docs/help/`; the
embedding loader climbs from `/app/config/ai` to the filesystem root, so the same allowlist
resolves inside the image and in a checkout. The committed Flutter build in `server/web` is copied
as part of `server/`.

The `ollama` service runs `ollama serve` in the background, waits for the API, pulls
`EMBED_MODEL` (`bge-m3`) once, then waits on the server process. The model volume keeps the
download across restarts. `server` depends on it with `service_started`, not `service_healthy`,
so a slow first pull never blocks the site; retrieval degrades to tool-only answers and the
stream marks that with `embed_down`.

Only `public/gallery` is mounted over the image. Mounting all of `/app/public` would hide
`pictures/`, `templates/`, the default images and the i18n catalogs that ship in the image.

`.dockerignore` keeps `.env`, `node_modules/` and the other built or local folders out of the
build context.

### CORS

`server/config/cors.js` builds a `cors` middleware per request. An origin is allowed when it is
absent (non-browser requests) or listed in `CORS_ORIGINS`; anything else gets a 403. The list must
contain the site's own public origin, because the built Vue assets carry `crossorigin` and asset
requests from the site itself still send `Origin`; without it every asset would answer 403 and the
page would never mount. The request's `Host` header is never trusted: the caller controls it, so
matching it would let any origin through. Behind a TLS proxy set `TRUST_PROXY=1` for correct
client protocol and cookies.

## Request lifecycle in server/

1. `server/app.js` - creates the app, CORS, body parsers, busboy (5 MB upload limit), static
   folders, maintenance gate, routers and the final error router.
   `server/routes/web/static_site.js` serves Vue at `/` and Flutter at `/flutter`, redirects the
   old `/web` paths to `/flutter/`, and only rewrites HTML navigations; missing assets still
   answer 404. It also replaces a missing `JWT_SECRET` with a random one and warns.
2. `server/config/admin/maintenance.js` - runs before the routers. While the `setting` row
   `maintenance` is `enabled`, every `/api/*` route answers 503 with `{status:"maintenance"}`.
   `/api/health`, `/api/auth/*` and `/api/admin/*` stay open so an admin can see the progress and
   finish the job. `MAINTENANCE_DISABLED=1` ignores a stuck flag.
3. `server/routes/api/*.js` - Express routers, mounted per feature: `auth`, `health`, `admin`,
   `ingredient`, `dish`, `template`, `gallery_upload`, `translate`, `ai`.
4. `server/config/database/connection.js` - one Mongoose connection and every schema.
   Models are exported as `database.collections.<Name>`.
5. `server/config/file/file_action.js` - moves uploaded files from `public/gallery/temporary/`
   into their final folder and rewrites the paths inside the JSON payload.
   `resolveInside(root, relativePath)` keeps request-driven paths inside the repository.
6. `server/routes/api/translate.js` - optional proxy to a LibreTranslate-compatible service
   (`TRANSLATE_URL`); answers 503 when none is configured.
7. `server/config/debug/app_debug.js` - appends to `server/config/debug/data/data_debug.txt`.
8. `server/config/template/*.js` - JSON templates for the editor (dish, ingredient, image block).

## Admin operations

The admin area is the `/admin` route of the Vue build; the API behind it is
`server/routes/api/admin.js`, guarded by `server/config/admin/require_admin.js` (valid cookie,
existing account, not disabled, `admin` role). Every failure answers `{error:{code, message}}`.

### Job runner

`server/config/admin/jobs.js` owns the queue in the `admin_job` collection. `app.js` calls
`runNextJob()` every 2 s; one job runs at a time and a call while a job is running is a no-op.
A job is claimed atomically (`queued` -> `running`), run through a per-type timeout (60 s,
10 min for `restore`, 5 min for `ai_index`), then saved as `done` or `failed` with `detail` or
`error`. Handlers: `backup`, `reset`, `restore`, `recalc_best_post` (ingredients only) and
`ai_index` (one row or a full rebuild; queued from content writes and the admin AI tab, coalesced
per row). Boot calls
`markInterruptedJobs()`: a `queued` or `running` row from the previous process becomes `failed`
with `detail: "server restarted"`, and the maintenance flag is cleared, because the dead job can
never release it. A job never auto-retries.

### Maintenance mode

Stored as the `setting` row `{key:"maintenance", enabled, reason, actor_id, actor_name,
owner_job_id, updated_at}`, cached for 1 s in the server. A destructive handler switches it on
before it writes and off in a `finally`, so a failed job still releases the site. Only the job
named in `owner_job_id` can clear the flag; an unowned flag can be cleared by anyone.

### Backup service

`server/config/admin/backups.js` writes gzip JSON `{format:"wdtct-backup", version:1,
created_at, collections}` to `BACKUP_DIR` (default `server/backups`, Compose `/app/backups`).
ObjectIds become 24-char hex strings, dates ISO 8601, `User.profile_image` base64. The archive
exports `ingredient`, `ingredient_post`, `dish`, `dish_post`, `vote`, `comment` and `user`;
`user` exists for disaster recovery and a restore ignores it. Files are written as `.part` then
renamed, named `backup-YYYYMMDD-HHmmss.json.gz` in UTC, and the newest 10 are kept. The same
format is read and written by `shared/BackupArchive.cs`, so the admin page and `db_control`
interchange archives.

`reset` and `restore` both write a backup before touching data. Reset drops the six catalog
collections, re-seeds them from `catalog/` (author: the acting admin) and recreates the unique
indexes. Restore validates the archive and every `_id`, stages all six collections as
`*_restore_<stamp>`, then swaps them with `renameCollection`; without admin rights it falls back
to drop-and-insert. Users, roles, `audit_log`, `admin_job` and settings are never replaced.

### Audit and users

`server/config/admin/audit.js` appends immutable `audit_log` rows (no update or delete path).
Admin sign-in and every admin mutation write one. User management can grant or remove the
`admin` role, disable an account and issue a temporary password; self-demotion, self-disable and
removing the last enabled admin answer 409.

## AI subsystem

`server/config/ai/` holds the assistant. `AI_ENABLED` gates the whole surface: while false,
`server/config/ai/config.js` is off and `/api/ai/*` answers 404 `ai_not_configured`.

| Module | Responsibility |
|---|---|
| `config.js` | Parses the 11 AI variables, estimates USD cost from a per-model table, and checks the runtime `ai_enabled` setting |
| `provider.js` | OpenAI-compatible chat adapter for `opencode-go` (sends `x-opencode-session`) and `ollama`, tool definitions, streamed or JSON replies |
| `embeddings.js` | Calls Ollama for `bge-m3` vectors, builds the allowlisted corpus, hashes content, retrieves by cosine |
| `index_job.js` | `ai_index` job handler, per-row coalescing and full rebuild |
| `events.js` | `user_event` recorder, per-UTC-day dedupe, history listing and personalisation weights |
| `tools.js` | Six bounded tools, gated by capability |
| `chat.js` | System prompt, retrieval, tool rounds, SSE streaming, transcript, quota and `ai_call` metrics |

### Request flow

```text
POST /api/ai/chat (SSE, verifyToken)
  AI on, not maintenance, user not disabled, budget not reached, quota remains
  1. validate message 1-2000, mode, capability, locale
  2. load the one rolling AiConversation (20 stored messages, 30-day TTL)
  3. embed the question through Ollama; on failure continue with tool-only retrieval
  4. retrieve top 6 ai_embedding passages by cosine, locale first, English fallback
  5. build the system prompt; retrieved text is wrapped in <retrieved_data> as data
  6. call the provider with the tools allowed by the capability, up to AI_MAX_TOOL_ROUNDS
  7. emit SSE events, persist the assistant message, write ai_call, count quota
```

SSE event names:

| Event | Payload |
|---|---|
| `meta` | `{embed_down, tool_summary}` |
| `tool` | `{name, summary, citations, action}` |
| `token` | `{text}` delta |
| `done` | `{citations, actions, quota}` |
| `error` | `{status, code, message}` |

A client abort aborts the upstream fetch, saves the partial reply as `stopped`, writes
`ai_call.status='stopped'` and does not consume quota. Provider failures write `failed` with the
error code, also without quota. `ai_call` stores counts only, never prompt, reply or retrieved
text.

The help corpus is a strict allowlist: `PRODUCT.md`, `README.md` and `docs/help/*.md`. Internal
docs (`docs/superpowers/`, `docs/impl/`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `API.md`,
`AGENTS.md`, `RULES.md`) are never listed, embedded or readable through `get_help`.

### Admin AI view

`GET /api/admin/ai/usage` aggregates `ai_call` by day and model and returns 50 recent metrics
rows, with no message text. `POST /api/admin/ai/enabled` writes the `ai_enabled` setting (in-flight
replies finish), `POST /api/admin/ai/users/:id` sets a user's `ai_disabled` and daily limit, and
`POST /api/admin/ai/reindex` queues a full `ai_index` job. Each mutation writes an audit row
(`ai.enabled`, `user.ai`, `job.ai_index`). `GET /api/admin/health` reports
`ai: {configured, enabled, budget_reached, provider, model}`.

## Catalog loader

`server/config/catalog/index.js` reads `catalog/ingredients.json`, `dishes.json`,
`dish-amounts.json`, `images.json` and `nutrition.json`, merges servings and grams into each dish
and exposes `loadCatalog()`. The admin reset calls `loadCatalog()`; `validateCatalog()`
(`validate.js`) exists but is not wired into it, as `docs/KNOWN_ISSUES.md` notes. The API,
`db_control` and the Windows console still produce the same 38 ingredients and 13 dishes. In the
container the folder is `/catalog`.

## Authentication

- Signup hashes with bcrypt (cost 10), assigns the `user` role (created on first signup).
- Signin signs a JWT `{id}` valid 24 h with `process.env.JWT_SECRET` and sets it as the
  `token` cookie (`httpOnly`, `sameSite=lax`, `secure` only on HTTPS). That cookie is the only
  carrier of the credential; the token is not returned in the response body. A disabled account
  answers 401.
- `routes/api/verifyToken.js` reads the cookie, verifies it, loads the user and roles,
  then sets `req.body.userid`, `req.roles` and `req.current_user`. Routes that need a user put
  `verifyToken` in the middleware chain; they must not trust a user id from the body.
- `POST /api/auth/password` changes the password and clears `must_change_password`.
- `POST /api/auth/signout` clears the cookie.
- On boot `promoteAdmin()` creates the roles and grants `admin` to `ADMIN_USERNAME` when that
  account exists. An unset or empty `ADMIN_USERNAME` promotes nobody.

## Clients

### Vue (`web_ui/`)

- Entry `src/main.js`; routes `src/router/index.js`; global styles `src/assets/css/`.
- API calls are thin wrappers in `src/assets/js/*_server_action.js`, all using
  `server_info.js` for the base URL (`VITE_SERVER_URL`, default `http://localhost:3000/`).
- Auth state lives in the Pinia store `src/assets/store/auth_store.js`. The API token is an
  httpOnly cookie, so the client only stores the display user (`user` cookie) and asks the
  server for anything protected. A router guard sends an account flagged
  `must_change_password` to the change-password screen.
- Admin screens: `src/views/admin/*.vue` with the shared components under
  `src/components/admin/`; copy for both languages comes from `/public/i18n/*.json`.
- Editor screens: `dish_edit_view.vue` / `ingredient_edit_view.vue` and the components under
  `src/components/edit_box/` and `src/components/display_block/`.

### Flutter (`flutter_web_dev/`)

- `lib/main.dart` sets routes: `/home`, `/dish_selection`, `/dish_detail`.
- Pages hold all network code; `lib/storages/app_storage.dart` holds the API base URL.
- Data classes parse the API envelopes in `lib/classes/data/`.
- `flutter build web`, then copy `build/web/*` over `server/web/` to update what the API serves.

## C# tools

Both are offline repair tools. Neither contacts the API and neither needs the server to run.

- `db_control/` - `init`, `backup --out`, `restore --file`, `recalc-best-post`, `health`.
  Exit codes 0 success, 1 failure, 2 usage error; destructive commands need `--yes` or a typed
  `RESET` / `RESTORE`.
- `database_control_center/` - the same operations in a WinForms window (Connection, Health,
  Operations, Log), for a machine without a terminal.

Both read `shared/` (catalog, seeding, backup archive) so they cannot drift from the server's
reset.

## Startup order

1. MongoDB reachable at `MONGODB_URI` (Compose waits for the `mongo` healthcheck).
2. `cd server && npm start`, or `docker compose up -d --build` for the whole stack.
3. Optional: `cd web_ui && npm run dev` for the Vue client on 5173.
4. An account named `ADMIN_USERNAME` must exist to be promoted; create it through
   `POST /api/auth/signup` and restart once.
