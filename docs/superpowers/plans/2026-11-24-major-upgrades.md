# Major dependency upgrades — plan

Date: 2026-11-24
Branch: `chore/major-upgrades`

## Intent

Move every runtime and toolchain dependency to its current major, in four verifiable stages, so Dependabot stops re-opening migrations. Each stage keeps the suite green before the next starts.

## Stages

| Stage | Upgrades | Proof |
|---|---|---|
| A. Web toolchain | vite 6→8, @vitejs/plugin-vue 5→6, vite-plugin-vue-devtools 7→8, pinia 3→4, vue-router 4→5, fontawesome 6→7 | `cd web_ui && npx vitest run` + `npm run build` |
| B. Server runtime | express 4→5, mongoose 6→9, fs-extra 10→11 | `cd server && npm test` (221) + live smoke |
| C. Flutter deps | http 1.6, cupertino_icons 2, url_strategy 0.3 | `flutter test` (92), `flutter analyze`, `flutter build web` |
| D. CI actions | actions/checkout v7, setup-node v7, setup-dotnet v6, fetch-metadata v3 | workflows run green on the PR |

## Known breakpoints to expect

- **Express 5**: `router.get('*')` and `'/flutter/*'` wildcards need named splats; async error handling changed; `res.sendFile` unchanged.
- **Mongoose 9**: callbacks removed, `strictQuery` default, connection option changes, `findOneAndUpdate` return shape; every schema in `connection.js`.
- **Vite 8**: config API and plugin peer ranges; Tailwind 4 plugin compatibility.
- **vue-router 5**: guard signature and route record changes; the admin guard and forced-password redirect.
- **pinia 4**: store setup API; auth store.
- **fs-extra 11**: ESM-only risk for scripts using `require`.
- **cupertino_icons 2**: font family asset change only.
- **Actions majors**: runner Node 24 requirement; pin if the org's runners are older.

## Rules

- One stage per commit; no stage starts until the previous proof is green.
- No behavior change beyond what the upgrade forces; keep the public API shapes.
- Rebuild `server/web_ui` and `server/web` when their toolchains move.
- Any breakage that needs a product decision stops the stage and is reported, not guessed.

## Verification

All stages green, then a live smoke: Compose stack up, sign in, one AI question, admin health, Vue site and `/flutter` render.
