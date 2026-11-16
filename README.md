# What dish to cook today?

Pick the ingredients you have at home and the site shows dishes that use them.
Signed-in users can create dishes and ingredients and write their detail pages.

## Parts

| Folder | What it is |
|---|---|
| `server/` | Express API, image upload, job queue, static host (port 3000) |
| `web_ui/` | Vue 3 client (current UI) |
| `flutter_web_dev/` | Older Flutter client; its build is copied into `server/web` |
| `database_control_center/` | .NET worker that reseeds data and picks best posts |
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
`CORS_ORIGINS`, `DATABASE_WORKER_EXE`, `TRUST_PROXY=1` behind a reverse proxy.

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
# copy build/web/* into server/web/ to serve it at http://localhost:3000/
```

## Data

The site needs users, roles and seeded content. `server/config/database/connection.js` defines
the collections; `docs/DATA_MODEL.md` explains the fields.

```bash
db_control --init_data      # drops and reseeds ingredient/dish collections
```

The seed requires a user `moonshine@gmail.com` to already exist, because posts reference it.

## Documentation

- [AGENTS.md](AGENTS.md) — repository map for new contributors and AI agents
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to build, test and commit
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — components, request flow, worker protocol
- [docs/API.md](docs/API.md) — every endpoint with request and response shapes
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — collections, invariants, seeding
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — what is still broken or unfinished
- [PRODUCT.md](PRODUCT.md) — product brief and user roles

## License

MIT. See [LICENSE](LICENSE).
