# What dish to cook today?

Pick the ingredients you have at home and the site shows dishes that use them.
Signed-in users can create dishes and ingredients and write their detail pages.

## Parts

| Folder | What it is |
|---|---|
| `server/` | Express API, image upload, job queue, static host (port 3000) |
| `web_ui/` | Vue 3 client (current UI) |
| `flutter_web_dev/` | Older Flutter client; its build is copied into `server/web` |
| `database_control_center/` | .NET offline console: reset, health, backup, restore (no API needed) |
| `db_control/` | .NET command line data tool |

## Requirements

- Node.js 22+
- MongoDB running on `localhost:27017`
- Optional: Flutter 3.32+ for the Flutter client
- Optional: .NET 9 SDK for the data tools

## Run the API

```bash
cd server
npm install
cp .env.example .env        # then set a real JWT_SECRET
npm start                   # http://localhost:3000
```

Environment variables (all optional except the secret): `JWT_SECRET`, `MONGODB_URI`,
`CORS_ORIGINS`, `TRANSLATE_URL`, `TRUST_PROXY=1` behind a reverse proxy. The .NET tools read
`MONGODB_URI` and never contact the API.

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

## Run the Vue client

```bash
cd web_ui
npm install
npm run dev                 # http://localhost:5173
```

The API base URL defaults to `http://localhost:3000/`; set `VITE_SERVER_URL` to change it.

## Run the Flutter client

```bash
cd flutter_web_dev
flutter pub get
flutter test
flutter build web
# copy build/web/* into server/web/ to serve it at http://localhost:3000/flutter
```

## Data

The site needs users, roles and seeded content. `server/config/database/connection.js` defines
the collections; `docs/DATA_MODEL.md` explains the fields. Both .NET tools read the canonical
`catalog/*.json`, so the CLI, the Windows console, the JS demo seed and the admin reset produce
the same 38 ingredients and 13 dishes.

The seed requires a user `moonshine@gmail.com` to already exist, because posts reference it.

## Offline tools

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

Backups are gzip JSON (`wdtct-backup` version 1), the same file the admin page downloads and
restores. They include password hashes for the `user` collection, so treat the file as sensitive;
a restore replaces the six catalog collections and leaves users, roles, audit rows and jobs alone.

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
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — components and request flow
- [docs/API.md](docs/API.md) — every endpoint with request and response shapes
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — collections, invariants, seeding
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — what is still broken or unfinished
- [PRODUCT.md](PRODUCT.md) — product brief and user roles

## License

MIT. See [LICENSE](LICENSE).
