# Contributing

## Setup

- Node.js 22 (see `.nvmrc`), MongoDB on `localhost:27017`, and optionally Flutter 3.32+ and .NET 9.
- `cd server && npm install`, then copy `server/.env.example` to `server/.env` and set a real
  `JWT_SECRET`.
- `cd web_ui && npm install` for the current web client.
- `cd flutter_web_dev && flutter pub get` for the Flutter client.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Repository map: [AGENTS.md](AGENTS.md).

## Verify before you push

Run the same commands CI runs. All of them must pass.

```bash
(cd server && npm ci && npm test)
(cd web_ui && npm ci && npm run build)
(cd flutter_web_dev && flutter pub get && flutter test && flutter analyze --no-fatal-infos)
dotnet build db_control/db_control/db_control.csproj
dotnet build database_control_center/database_control_center/database_control_center.csproj
```

The server test suite uses Node's built-in runner (`node --test`, files under `server/test`).
Add a test with any change to a branch, a loop, input validation, or a filesystem path.

## Branches and commits

- Branch off `main`: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- One concern per commit. Message format: `type: imperative subject`, body explains why.
- Keep pull requests small enough to review in one sitting.

## Never commit generated output

`web_ui/dist`, `bin/`, `obj/`, `.vs/`, `.dart_tool/`, `android/app/.cxx/` and any `.env` are
ignored. Do not force-add them.

`server/web` and `server/web_ui` are the exception: they are the Flutter and Vue builds the API
serves. They are generated but tracked on purpose, so a client change is expected to rebuild
the matching build and commit the result. Everything else above stays ignored.

Known problems worth fixing are listed in [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).
