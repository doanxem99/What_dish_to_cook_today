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
cp .env.example .env        # then set a real JWT_SECRET; Compose refuses to start without it
docker compose up -d --build
docker compose ps           # wait for server "healthy"
```

- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Health: `http://localhost:3000/api/health`, admin health: `/api/admin/health`

The stack runs `server`, `mongo` and `libretranslate` (en/vi). Volumes: `mongo-data` (database),
`backup-data` (archives at `/app/backups`), `gallery` (`public/gallery` uploads) and
`translate-models`. Only port 3000 is published.

The first run has no account. Create one, set `ADMIN_USERNAME` to it in `.env`, then restart the
server once so boot promotes it:

```bash
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"username":"moonshine@gmail.com","email":"moonshine@gmail.com","password":"change-me-now"}'
# .env: ADMIN_USERNAME=moonshine@gmail.com
docker compose restart server
```

`ADMIN_USERNAME` is promoted only when it is set and the account already exists. It is empty in
`.env.example`, so set it to the account you created before the restart. After that, sign in at
`/admin`; the account can change its password at `/change-password`.

If port 3000 is taken, set `SERVER_PORT=3100` in `.env` (the server keeps listening on 3000
inside the container) and add `http://localhost:3100` to `CORS_ORIGINS`. An origin that is not
listed is refused, so the site's own public origin always belongs in that list.

`docker compose down -v` removes the stack **and its data**. Use `docker compose down` to keep it.

## Environment

Compose reads a root `.env` (template: `.env.example`). Run the API without Docker and it reads
`server/.env` (template: `server/.env.example`) instead. Same names, different file.

| Variable | Default | Meaning |
|---|---|---|
| `JWT_SECRET` | required in Compose | Signs the session cookie. Compose refuses to start without it; a random one would lose logins on restart. |
| `MONGODB_URI` | `mongodb://localhost:27017/what_dish_to_cook_today` | Database. Compose pins `mongodb://mongo:27017/what_dish_to_cook_today`, no `directConnection`. |
| `CORS_ORIGINS` | localhost:3000/5173 | Allowed origins, comma separated. Must include the site's own public origin; any other origin is refused. |
| `ADMIN_USERNAME` | empty | Account promoted to admin on boot when it is set and the account exists. |
| `BACKUP_DIR` | `server/backups` | Where the backup job writes archives. Compose pins `/app/backups` on the `backup-data` volume. |
| `TRANSLATE_URL` | `http://localhost:5000/translate` | LibreTranslate-compatible service. Compose pins `http://libretranslate:5000/translate`. |
| `AI_ENABLED` | `false` | Shows the reserved AI metrics view. Nothing calls a provider yet. |
| `MAINTENANCE_DISABLED` | `0` | Escape hatch for a stuck maintenance flag. |
| `TRUST_PROXY` | unset | Set to `1` behind a reverse proxy so cookies and CORS see HTTPS. Compose forwards it. |

Compose pins `MONGODB_URI`, `BACKUP_DIR` and `TRANSLATE_URL` to the service names and volumes it
creates, so `.env` values for those three are ignored. Use `server/.env` when you run the API
without Compose.

`CORS_ORIGINS` needs the site's own origin because the built Vue assets carry `crossorigin` and
send an `Origin` header even from the same host. Only listed origins are accepted; the `Host`
header is caller-controlled and is never used to grant access.

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

`db_control backup` writes the same `backup-YYYYMMDD-HHmmss.json.gz` name (UTC) in the current
directory unless `--out` names another file, and the Windows console offers that name too. The
admin page lists only that pattern inside `BACKUP_DIR`, so copy an archive made elsewhere into
`BACKUP_DIR` (`server/backups` locally, `/app/backups` in Compose) before restoring it from
`/admin`; an explicit `--out` keeps the name the operator chose.

## Offline repair kit

`db_control` is the command line repair kit. It needs only MongoDB; the API server may be down.
The Windows console (`database_control_center`) offers the same operations in tabs: Connection,
Health, Operations and Log. Every destructive action there writes a backup first.

```bash
dotnet build db_control/db_control/db_control.csproj
dotnet run --project db_control/db_control -- health
dotnet run --project db_control/db_control -- init --yes
dotnet run --project db_control/db_control -- backup
dotnet run --project db_control/db_control -- restore --file backup-20261118-090232.json.gz --yes
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
