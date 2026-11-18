# What dish to cook today?

Pick the ingredients you have at home and the site shows dishes that use them.
Signed-in users can create dishes and ingredients and write their detail pages. Admins get a
guarded `/admin` area for jobs, backups, users and audit history.

## Parts

| Folder | What it is |
|---|---|
| `server/` | Express API, image upload, admin job queue, static host (port 3000) |
| `web_ui/` | Vue 3 client (current UI, including `/admin`) |
| `flutter_web_dev/` | Older Flutter client; its build is copied into `server/web` |
| `database_control_center/` | .NET offline console: reset, health, backup, restore (no API needed) |
| `db_control/` | .NET command line data tool |
| `catalog/` | Canonical seed data shared by the server reset and both .NET tools |
| `shared/` | C# seeding, catalog and backup code used by both .NET tools |

## Quick start with Docker Compose

```bash
cp .env.example .env        # then set a real JWT_SECRET
docker compose up -d --build
docker compose ps           # wait for server "healthy"
```

- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Health: `http://localhost:3000/api/health`, admin health: `/api/admin/health`

The stack runs `server`, `mongo` and `libretranslate` (en/vi). Volumes: `mongo-data` (database),
`backup-data` (archives at `/app/backups`), `gallery` (`public/gallery` uploads) and
`translate-models`. Only port 3000 is published.

The first run has no account. Create one, then restart the server once so boot promotes it:

```bash
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"username":"moonshine@gmail.com","email":"moonshine@gmail.com","password":"change-me-now"}'
docker compose restart server
```

`ADMIN_USERNAME` (default `moonshine@gmail.com`) is promoted only when the account already
exists. After that, sign in at `/admin`; the account can change its password at `/change-password`.

If port 3000 is taken, set `SERVER_PORT=3100` in `.env` (the server keeps listening on 3000
inside the container) and add `http://localhost:3100` to `CORS_ORIGINS`. The own-origin rule
also accepts that page, but listing it keeps a proxy setup explicit.

`docker compose down -v` removes the stack **and its data**. Use `docker compose down` to keep it.

## Environment

Compose reads a root `.env` (template: `.env.example`). Run the API without Docker and it reads
`server/.env` (template: `server/.env.example`) instead. Same names, different file.

| Variable | Default | Meaning |
|---|---|---|
| `JWT_SECRET` | random per boot | Signs the session cookie. Without it logins die on restart. |
| `MONGODB_URI` | `mongodb://localhost:27017/what_dish_to_cook_today` | Database. Compose: `mongodb://mongo:27017/what_dish_to_cook_today`, no `directConnection`. |
| `CORS_ORIGINS` | localhost:3000/5173 | Extra allowed origins, comma separated. Must include the site's own public origin. |
| `ADMIN_USERNAME` | `moonshine@gmail.com` | Account promoted to admin on boot when it exists. |
| `BACKUP_DIR` | `server/backups` | Where the backup job writes archives. Compose mounts `backup-data` at `/app/backups`. |
| `TRANSLATE_URL` | `http://localhost:5000/translate` | LibreTranslate-compatible service. Compose: `http://libretranslate:5000/translate`. |
| `AI_ENABLED` | `false` | Shows the reserved AI metrics view. Nothing calls a provider yet. |
| `MAINTENANCE_DISABLED` | `0` | Escape hatch for a stuck maintenance flag. |
| `TRUST_PROXY` | unset | Set to `1` behind a reverse proxy so cookies and CORS see HTTPS. |

`CORS_ORIGINS` needs the site's own origin because the built Vue assets carry `crossorigin` and
send an `Origin` header even from the same host. The server accepts an origin equal to the
request's own host without listing it, but proxy setups should still list the real domain.

## Migrating an existing deployment

The `database_control_center` worker and the `/worker` WebSocket endpoint are gone. Admin
operations (reset, backup, restore, recalc best post) now run inside the API server, one at a
time, through the `admin_job` queue.

1. Remove `DATABASE_WORKER_EXE` and `WORKER_WS_URL` from the environment. Nothing reads them.
2. Stop the old Windows worker window. It can no longer connect; use the offline console in
   `database_control_center/` if you need a desktop tool.
3. Old `database_worker_job` rows are not read. Delete that collection after a backup.
4. Add `JWT_SECRET`, `ADMIN_USERNAME` and `BACKUP_DIR`, and set `CORS_ORIGINS` to the site's own
   origin.
5. If the container replaces a local install, copy `server/public/gallery` into the `gallery`
   volume and `server/backups` into `backup-data`, or restore from an archive instead.

A backup made by `db_control` restores through `/admin`, and a server backup restores through
`db_control restore`, because both use the same gzip JSON contract.

## Run the API without Docker

Requires Node.js 22+ and MongoDB on `localhost:27017`.

```bash
cd server
npm install
cp .env.example .env        # then set a real JWT_SECRET
npm start                   # http://localhost:3000
```

Optional translation for the editor: run a LibreTranslate-compatible service and point
`TRANSLATE_URL` at it. For example:

```bash
docker run -d --name libretranslate -p 5000:5000 \
  -e LT_LOAD_ONLY=en,vi -e LT_UPDATE_MODELS=false \
  libretranslate/libretranslate:latest
# server/.env: TRANSLATE_URL = http://localhost:5000/translate
```

Without it the editor's auto-translate toggle reports that translation is unavailable and you
enter both languages yourself.

## Run the Vue client for development

```bash
cd web_ui
npm install
npm run dev                 # http://localhost:5173
```

The API base URL defaults to `http://localhost:3000/`; set `VITE_SERVER_URL` to change it.
The dev server does not serve `/public/i18n/*.json`, so interface keys show raw in `npm run dev`;
the build served by Express is fine.

## Run the Flutter client

```bash
cd flutter_web_dev
flutter pub get
flutter test
flutter build web
# copy build/web/* into server/web/ to serve it at http://localhost:3000/flutter
```

## Data and backups

The site needs users, roles and seeded content. `server/config/database/connection.js` defines
the collections; `docs/DATA_MODEL.md` explains the fields. `catalog/*.json` is the canonical
catalog: the admin reset, `db_control init` and the Windows console all produce the same 38
ingredients and 13 dishes with nutrition, amounts and images.

The admin reset writes a backup first, then rebuilds the six catalog collections and recreates
their unique indexes. Users, roles, audit rows, jobs and settings survive a reset.

Server backups land in `BACKUP_DIR` (`server/backups` locally, the `backup-data` volume in
Compose). Each is `backup-YYYYMMDD-HHmmss.json.gz`, the newest 10 are kept, and the archive
includes password hashes for `user`, so treat it as sensitive. A restore replaces the catalog
only.

## Offline repair kit

`db_control` is the command line repair kit. It needs only MongoDB; the API server may be down.
The Windows console (`database_control_center`) offers the same operations in tabs: Connection,
Health, Operations and Log. Every destructive action there writes a backup first.

```bash
dotnet build db_control/db_control/db_control.csproj
dotnet run --project db_control/db_control -- health
dotnet run --project db_control/db_control -- init --yes
dotnet run --project db_control/db_control -- backup --out backups/backup.json.gz
dotnet run --project db_control/db_control -- restore --file backups/backup.json.gz --yes
dotnet run --project db_control/db_control -- recalc-best-post <ingredient_id>
```

Global options: `--uri` (else `MONGODB_URI`, then `mongodb://localhost:27017`), `--db`
(default `what_dish_to_cook_today`), `--json`, `--yes`, `--help`, `--version`.
Exit codes are 0 success, 1 failure and 2 usage error. `init` and `restore` are destructive: pass
`--yes` or type `RESET` / `RESTORE` in a terminal. Without a terminal and without `--yes` they
refuse with exit code 2.

The offline self-check builds and runs without a server or database:

```bash
dotnet run --project db_seed_tests
```

Package the console for a machine without the .NET SDK:

```bash
dotnet publish database_control_center/database_control_center/database_control_center.csproj \
  -c Release -r win-x64 --self-contained
```

## Documentation

- [AGENTS.md](AGENTS.md) — repository map for new contributors and AI agents
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to build, test and commit
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — components, request flow, Compose and admin operations
- [docs/API.md](docs/API.md) — every endpoint with request and response shapes
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — collections, invariants, seeding, backups
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — what is still broken or unfinished
- [PRODUCT.md](PRODUCT.md) — product brief and user roles

## License

MIT. See [LICENSE](LICENSE).
