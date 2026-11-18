# Admin operations and offline repair kit — design

## Intent

Several admins will run this site, possibly from different machines. Today the only administrative surface is a Windows worker app that another Windows process has to keep alive, plus a console tool that seeds or repairs the database. Neither is safe to hand to a second person: no identity, no audit, no backups, no visible state, and the worker's reset path used to corrupt data.

This design creates one operational home inside the existing site (`/admin`), moves execution into the server, and turns the two desktop tools into an offline repair kit that works when the server does not.

AI features do not exist yet. The admin page reserves a metrics-only view for them and a live health strip for external services such as LibreTranslate.

## Goals

- One place where an admin can see whether the system is healthy and what it is doing.
- Identity and audit for every administrative action.
- A destructive reset that cannot happen by accident and can be undone.
- User and role management that cannot lock everyone out.
- A future AI panel that shows cost, latency, tokens and errors without exposing user text.
- A repeatable Docker Compose deployment for server, MongoDB and LibreTranslate.
- Desktop tools that are safe, documented, and useful when the web admin is unavailable.

## Non-goals

- Building the AI itself, prompt design or model selection.
- Content moderation beyond the existing comment delete.
- Email, password-reset links, SSO, multi-tenancy.
- Changing the public catalog editors; they stay where they are.
- Keeping the .NET WebSocket worker protocol. The server replaces it.

## Anti-goals

- A reset that can run without a backup.
- Prompt or response text visible in admin metrics.
- Granting admin from the CLI or environment only, leaving no in-app path.
- A deployment that depends on a Windows desktop being awake.
- Duplicating the catalog seed between JavaScript and C#.

## Decisions already made

| Topic | Decision |
|---|---|
| Audience | Several admins, possibly remote |
| Authentication | Existing accounts plus an `admin` role |
| Reset | Type `RESET`; server writes a full backup first |
| Restore | Type `RESTORE`; server backs up current data first |
| Backups | Newest 10 kept on a volume; listed and downloadable |
| Execution | Server runs operations in-process and records a job |
| Admin scope | Operations console plus user management |
| AI visibility | Metrics only: model, latency, tokens, cost, errors, retry, disable switch |
| External services | Health strip for database, translation, AI configuration |
| Roles | Admins manage admins; never remove the last admin or self-demote; disabling ends access |
| Deployment | Docker Compose: server, Mongo, LibreTranslate, volumes |
| Desktop tools | CLI hardened; WinForms becomes an offline console without the worker role |
| Reset scope | Catalog-only: `ingredient`, `ingredient_post`, `dish`, `dish_post`, `vote`, `comment` |
| Catalog completeness | Full package with nutrition, dish amounts and image maps |
| Backup format | One documented gzip JSON format shared by Node and C# |
| Temporary passwords | Must change at next sign-in |
| Admin language | Bilingual EN/VI, same catalogue |
| During reset/restore | Maintenance mode: public writes 503, reads show a banner, admin sees progress |

## Resolved during the builder check

- Reset scope is catalog-only: drop and rebuild `ingredient`, `ingredient_post`, `dish`, `dish_post`, `vote`, `comment`. `user`, `role`, `audit`, `admin_job` and settings always survive. The acting admin cannot delete their own account through reset.
- Backups contain the catalog collections plus `user` rows (hashed passwords) for disaster export; restore in v1 restores catalog collections only. `audit` and `admin_job` are never restored. The download is admin-only and documented as sensitive.
- The catalog package lives at repo root `catalog/`: `ingredients.json`, `dishes.json`, `nutrition.json`, `dish-amounts.json`, `images.json`. Full content: 38 ingredients, 13 dishes, photos, nutrition, per-serving amounts. Docker copies it into the server image; C# copies it to output and reads it from there.
- One backup contract: gzip JSON `{format:"wdtct-backup", version:1, created_at, collections:{name:[docs]}}`; Node and C# both read and write it, so a CLI backup restores in the page and the reverse.
- Temporary passwords set `must_change_password`; sign-in returns the flag, the Vue app forces a change screen, and `POST /api/auth/password` clears it. Admins see the temporary password once at creation.
- Admin page is bilingual; keys go into both i18n catalogues.
- Reset/restore sets a `maintenance` flag in a `settings` document. Public API writes answer 503, reads answer 503 except the health endpoint, and the Vue shell shows a banner. The flag clears when the job ends, including on failure.
- `/api/health` is public and exposes liveness only (no counts, no latency). `/api/admin/health` keeps the detail.
- Sign-in checks `is_disabled` and returns `roles` and `must_change_password`; the Vue router gains a `requiresAdmin` guard and the header links `/admin` only for admins.
- After reset or restore the server recreates the unique indexes for `user.username`, `user.email`, `role.name` and `vote(user_id, dish_post_id)`.
- On boot, any `admin_job` left `queued` or `running` is marked `failed` with a "server restarted" detail.
- Compose mounts only `public/gallery` as an upload volume; `public/pictures` and `public/templates` stay inside the image. The Vue build is a Compose build stage, copied into `server/web_ui`.
- Tests assert the `catalog/*.json` files are internally consistent (every dish ingredient exists, every nutrition key exists, image files present) in `npm test`; a small C# test checks the loader reads the same files. Node tests do not require `dotnet`.
- `db_control` accepts `--uri` and `--db` with the current values as defaults. Best-post recalculation is ingredient-only in v1; dishes are explicitly out of scope.
- `/api/admin/*` uses real status codes (400, 401, 403, 404, 409, 502) documented in `docs/API.md`. Existing public routes keep their envelopes.
- Audit rows: `actor_id`, `actor_name`, `action`, `target_type`, `target_id`, `result`, `detail`, `ip`, `created_at`; list is paginated newest-first and immutable through the API.
- Translation health derives the base from `TRANSLATE_URL` (strip `/translate`), probes `/languages` with a 30 s cache, never on the page poll.
- Docs and env to update: `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATA_MODEL.md`, `docs/KNOWN_ISSUES.md` items 9, 16, 21, `server/.env.example` (drop `DATABASE_WORKER_EXE`, add `ADMIN_USERNAME`, `BACKUP_DIR`, `AI_ENABLED`, `MAINTENANCE_DISABLED`), both `.gitignore` files for `backups/`.
- Compose maps port 3000 and uses `mongodb://mongo:27017/what_dish_to_cook_today` without `directConnection`.

## Approaches considered

**A. Web admin only, delete both desktop tools.** Smallest build and maintenance. Rejected because recovery then depends on the server that may be the thing that is broken.

**B. Web admin primary, desktop tools as an offline repair kit (chosen).** The server owns routine operations with audit and backups; `db_control` stays a real CLI for Docker bootstrap, CI and recovery; the WinForms app loses the worker and becomes a small offline console: connection test, health and counts, typed operations with confirmations, backup and open-folder, log file. Two surfaces, one shared catalog source, each with a clear job.

**C. Separate admin SPA, desktop tools polished as today.** Strong isolation, but a second UI to build, theme, translate and deploy, and the worker remains a deployment dependency that adds nothing once the server can execute operations.

## How it works

### Roles and identity

- `Role` gains an `admin` role. `User` gains `is_disabled` and `roles` is used for checks.
- `requireAdmin` middleware: valid cookie, existing user, not disabled, admin role. Every `/api/admin/*` route uses it.
- Bootstrapping: `ADMIN_USERNAME` (default `moonshine@gmail.com`) is promoted on server start if the account exists; the CLI can promote too. After that, admins grant admins in the page.
- Guards: cannot demote the last admin, cannot demote or disable yourself, disabling ends access on the next request. Password reset generates a temporary password shown once and stored hashed.

### Operations and jobs

- `admin_job` collection: `type` (`reset`, `backup`, `restore`, `recalc_best_post`, later `ai`), `status` (`queued`, `running`, `done`, `failed`), `actor_id`, `created_at`, `started_at`, `finished_at`, `detail`, `error`, plus reserved AI fields `provider`, `model`, `latency_ms`, `tokens_in`, `tokens_out`, `cost_estimate`.
- An in-process runner with concurrency 1 picks queued jobs; the HTTP route returns immediately with the job row. Admin page polls the job list.
- AI fields are written by future AI calls; the admin page shows numbers only. No prompt or response is stored in the job.
- WebSocket worker code, `database_worker_job`, the spawn path and `DATABASE_WORKER_EXE` are removed from the server. The job table is renamed because the protocol no longer exists.

### Health

`GET /api/admin/health` returns: server uptime/version, Mongo ping and latency, collection counts (users, ingredients, dishes, posts, comments, votes), translation reachable (cached 30 s, `/languages`), AI configured flag (environment only), backup volume writable, last backup time, last reset time. The page refreshes every 15 s and shows a red/green strip.

### Backups

- One documented contract: gzip JSON `{format: "wdtct-backup", version: 1, created_at, collections: {name: [documents]}}`, written and read by both Node and C#. Same file restores through the admin page or the CLI.
- Archive contents: the six catalog collections plus `user` (hashed passwords) for disaster export. `audit` and `admin_job` are excluded. The file is sensitive; download is admin-only.
- Path: `BACKUP_DIR` (default `server/backups`, mounted volume in Compose), filenames `backup-YYYYMMDD-HHmmss.json.gz`.
- Keep newest 10; older files deleted after a successful write.
- Reset: route requires `confirm: "RESET"`; server creates a backup first, records its name on the job, then drops and reseeds the six catalog collections from `catalog/`. A failed backup aborts the reset.
- Restore: requires `confirm: "RESTORE"` and a backup id; server backs up current data first, validates that every required catalog collection is present, then replaces catalog collections. Users, roles, audit, jobs and settings are not touched.
- Download: admin-only stream; no path taken from the request, only known backup ids.

### Canonical catalog

- The catalog lives in versioned JSON under `catalog/` at the repo root: `ingredients.json` (names, types, descriptions, nutrition), `dishes.json` (names, descriptions, steps), `dish-amounts.json` (servings and grams), `images.json` (dish and ingredient photo paths), `nutrition.json` (USDA per-100 g values).
- The JS seed, the admin reset, and the C# CLI read the same files. Docker copies `catalog/` into the server image; the C# projects copy it to their output directories.
- This removes the 38/13 versus 9/1 split. The WinForms console reads them through the shared seed too; no hand-written seed remains in C#.
- Image credits stay in `docs/IMAGE_CREDITS.md` and the seed image JSON.

### Admin page

Routes inside the existing Vue app, linked only for admins:

- `/admin` dashboard: health strip, counts, last jobs, last backup, quick actions.
- `/admin/jobs`: filterable list, job detail, retry for failed operational jobs (never silent).
- `/admin/backups`: list, download, restore dialog with typed `RESTORE`.
- `/admin/users`: list, search, promote/demote, disable, temporary password.
- `/admin/ai` (reserved): metrics table and disable switch, hidden until AI configuration exists.
- `/admin/audit`: immutable rows for role changes, resets, restores, backup downloads, logins as admin.

Visual language follows `.impeccable/surfaces/web-ui.md`: Operate mode, compact rows, ruled surfaces, no new component library.

### API sketch

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/health` | system strip |
| GET | `/api/admin/jobs` | jobs, newest first, filter by type/status |
| POST | `/api/admin/jobs/recalc-best-post` | `{ingredient_id}` |
| POST | `/api/admin/backup` | create backup |
| GET | `/api/admin/backups` | list backups |
| GET | `/api/admin/backups/:id` | download |
| POST | `/api/admin/restore` | `{backup_id, confirm:"RESTORE"}` |
| POST | `/api/admin/reset` | `{confirm:"RESET"}` |
| GET | `/api/admin/users` | list and search |
| POST | `/api/admin/users/:id/role` | `{admin: true|false}` |
| POST | `/api/admin/users/:id/disabled` | `{disabled: bool}` |
| POST | `/api/admin/users/:id/password` | temporary password |
| GET | `/api/admin/audit` | audit rows |
| GET | `/api/health` | public liveness only |
| POST | `/api/auth/password` | change password, clears `must_change_password` |

### Desktop tools

`db_control` (CLI):
- Commands: `init`, `backup --out`, `restore --file`, `recalc-best-post <id>`, `health`.
- Global options: `--uri` (else `MONGODB_URI`), `--db`, `--json`, `--yes`, `--help`, `--version`.
- Exit codes: 0 success, 1 failure, 2 usage error. Destructive commands require `--yes` or an interactive `RESET`/`RESTORE` prompt.
- Reads the canonical `catalog/*.json`; no duplicated seed.

WinForms offline console:
- No WebSocket, no background job polling.
- Tabs: Connection (URI, test, database name), Health (ping, counts), Operations (reset, recalc best post, backup to file, restore from file) with typed confirmations, Log (file-backed).
- Uses the shared seed and the same safety rules; refuses reset when the admin user is missing.
- Packaging: `dotnet publish -c Release -r win-x64 --self-contained` documented; optional tray minimize.

### Docker Compose

- Services: `mongo` (volume `mongo-data`), `server` (Node 22, volumes `backup-data` at `/app/backups` and `gallery` at `/app/public/gallery`, env from `.env`), `libretranslate` (en/vi only, models cached in a volume), optional `caddy` for HTTPS.
- Healthchecks for mongo (`mongosh ping`) and server (`/api/health`), restart policies, no ports exposed except server and Caddy.
- `.env.example`: `JWT_SECRET`, `MONGODB_URI=mongodb://mongo:27017/what_dish_to_cook_today`, `ADMIN_USERNAME`, `BACKUP_DIR`, `TRANSLATE_URL=http://libretranslate:5000/translate`.

## Acceptance criteria

- A non-admin cannot read or call any `/api/admin/*` route; a disabled admin loses access on the next request.
- The last admin cannot be demoted or disabled, and admins cannot demote themselves.
- Reset without `confirm:"RESET"` is refused; with it, a backup file exists before any drop, and the job records its name.
- Restore refuses an archive missing a required collection and never leaves partial data.
- The admin page shows database, translation and AI-configured status without leaking prompts.
- `db_control --help`, invalid usage and failures return documented exit codes.
- The WinForms console starts with no server running, tests the database, and can back up without the API.
- One `catalog/` JSON set feeds JS, the admin reset and the C# CLI; a test asserts the three loaders agree on counts and names.
- Docker Compose brings the stack up from a clean volume and serves the site and admin page.
- During reset and restore, public writes answer 503 and the site shows the maintenance banner; the flag clears afterwards, including on failure.
- A temporary password forces a change at next sign-in and the admin sees it only once.
- A backup written by `db_control` restores through the admin page, and a server backup restores through `db_control`.
- Reset leaves `user`, `role`, `audit`, `admin_job` and settings untouched, and recreates unique indexes afterwards.

## Risks and open points

- Backups include password hashes; the volume and downloads are admin-only and documented as sensitive. Encryption is out of scope for v1.
- In-process execution means a long restore blocks only the ops runner, not HTTP; but the server must not restart mid-restore. Restore writes to temporary collections then swaps, so a crash leaves the old data readable.
- Removing the worker is a breaking change for any deployment still relying on `DATABASE_WORKER_EXE`; README migration note required.
- AI metrics fields exist before AI does; the page stays hidden until `AI_ENABLED` is set.
- The 38/13 catalog move to `catalog/*.json` touches the demo seed and both C# tools; it is the largest data change in this design.
