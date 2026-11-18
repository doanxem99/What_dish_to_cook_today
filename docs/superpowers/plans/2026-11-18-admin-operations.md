# Admin Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a bilingual `/admin` operations area with roles, audit, jobs, backups, typed reset/restore, user management and AI/service health, run all operations in the server, and turn the two .NET tools into a safe offline kit with one shared catalog and backup format.

**Architecture:** The Express server gains the admin role, an audit log, an in-process job runner, a gzip backup service and a catalog loader that reads `catalog/*.json`. The Vue client gains an admin subnav and six Operate-mode views on the existing board. The WebSocket worker protocol is removed; `db_control` becomes a real CLI and the WinForms app an offline console, both reading the same catalog and backup contract.

**Tech Stack:** Node 22 + Express 4 + Mongoose 6 + `node:zlib`, Vue 3 + Vite 6, .NET 9 (MongoDB.Driver 3.2.1), Docker Compose.

**Spec:** [docs/superpowers/specs/2026-11-18-admin-operations-design.md](../specs/2026-11-18-admin-operations-design.md) · **Shape:** [.impeccable/surfaces/admin-operations.md](../../../.impeccable/surfaces/admin-operations.md)

## Global Constraints

- Admin routes answer real HTTP codes: 400 bad input, 401 anonymous, 403 not admin/disabled, 404 missing, 409 guard conflict, 502 upstream failure.
- Reset and restore touch only: `ingredient`, `ingredient_post`, `dish`, `dish_post`, `vote`, `comment`. Never `user`, `role`, `audit`, `admin_job`, `settings`.
- Every reset/restore writes a backup first; a failed backup aborts the operation.
- Backups keep the newest 10; files live under `BACKUP_DIR`.
- Admin UI strings are keys in both `server/public/i18n/en.json` and `vi.json`; no literals.
- No new npm runtime dependency for gzip, CSV or scheduling; Node built-ins and the existing stack only.
- Same board tokens/components; no chart library, no dashboard card grid.
- `catalog/*.json` is the only catalog source; no hand-written seed remains in C#.
- Tests: `server npm test`, `web_ui npx vitest run`, `dotnet test` for the new C# test project, `flutter test` untouched.

## File structure

| Path | Responsibility |
|---|---|
| `catalog/ingredients.json`, `dishes.json`, `dish-amounts.json`, `images.json`, `nutrition.json` | canonical catalog |
| `server/config/catalog/index.js` | load + validate the catalog |
| `server/config/catalog/validate.js` | integrity rules |
| `server/config/admin/require_admin.js` | role + disabled check |
| `server/config/admin/audit.js` | audit rows |
| `server/config/admin/jobs.js` | job model helpers + runner |
| `server/config/admin/backups.js` | gzip backup read/write/prune |
| `server/config/admin/maintenance.js` | settings flag helpers |
| `server/config/admin/reset.js` | catalog reset + restore swap + index recreation |
| `server/routes/api/admin.js` | admin endpoints |
| `server/routes/api/health.js` | public liveness |
| `server/routes/api/auth.js` | roles, disabled, must-change, password change |
| `server/config/worker/` | deleted |
| `web_ui/src/views/admin/*.vue` | Overview, Jobs, Backups, Users, AI, Audit |
| `web_ui/src/components/admin/*` | status strip, probe row, job table, danger dialog |
| `web_ui/src/assets/store/auth_store.js` | roles + mustChange |
| `web_ui/src/router/index.js` | requiresAdmin, mustChange guard |
| `shared/DatabaseSeed.cs` | reads `catalog/*.json` |
| `db_control/db_control/*` | commands, options, exit codes |
| `database_control_center/database_control_center/*` | offline console; worker code deleted |
| `docker-compose.yml`, `server/Dockerfile`, `.dockerignore`, `.env.example` | deployment |
| `server/test/catalog.test.js`, `admin.test.js`, `backups.test.js`, `jobs.test.js`, `auth.test.js` | server tests |
| `web_ui/src/views/admin/*.test.js` | pure helpers/tests |
| `db_seed_tests/` | C# loader test project |

## Review Focus

- Reset/restore atomicity: a crash mid-restore must leave the previous catalog readable.
- Lockout: last admin, self-demotion, self-disable, disabled account with a live cookie.
- Maintenance flag always clears, including failed jobs and server restart.
- Backup contract agreement: a C#-written archive restores through the server, byte-for-byte round trip of BSON-friendly values.
- Docker volumes: `public/pictures` stays available; only `public/gallery` is mounted.
- Temp password path: shown once, forces change, old sessions still valid until next request.

---

### Task 1: Canonical catalog and loader

**Files:** create `catalog/*.json`, `server/config/catalog/index.js`, `server/config/catalog/validate.js`, `server/test/catalog.test.js`; modify `server/scripts/dev-demo.mjs`, `server/scripts/seed-catalog.mjs`, `server/scripts/seed-dishes.mjs`.

**Interfaces:**
- `loadCatalog(): { ingredients: object[], dishes: object[], amounts: object, images: object, nutrition: object }`
- `validateCatalog(catalog): string[]` returns problems.
- Ingredient shape: `{name, name_vi, type, short_detail, short_detail_vi, nutrition:{description, per_100g:{calories, protein, fat, carbs, fiber, sodium}}}`.
- Dish shape: `{name, name_vi, short_detail, short_detail_vi, steps:[{text,text_vi}], ingredients:[name], servings, amounts:{ingredientName:grams}}`.

- [ ] Write failing tests: 38 ingredients, 13 dishes, every dish ingredient exists, every ingredient has nutrition and an image path, no duplicate names, image files exist under `server/public`.
- [ ] Run `npm test` and watch the missing catalog/loader fail.
- [ ] Generate `catalog/*.json` from today's seed modules (one-off script, committed output); keep file order and Vietnamese text exactly.
- [ ] Implement loader + validator; make `dev-demo.mjs` seed from `loadCatalog()` (servings, nutrition, amounts, images) and delete the duplicated arrays.
- [ ] Test green; demo still returns the same 38/13 with nutrition.

### Task 2: Roles, disabled accounts, password change

**Files:** modify `server/config/database/connection.js`, `server/routes/api/auth.js`, `server/routes/api/verifyToken.js`; create `server/config/admin/require_admin.js`, `server/test/auth.test.js`.

**Interfaces:**
- `User` gains `is_disabled: Boolean`, `must_change_password: Boolean`; `Role` seeded with `admin`.
- `requireAdmin(req,res,next)` → 401/403 or `next()`.
- Sign-in response adds `roles: string[]` and `must_change_password`.
- `POST /api/auth/password {current_password, new_password}` verifies and clears the flag.
- Boot promotes `ADMIN_USERNAME` if the account exists.

- [ ] Failing tests: disabled account cannot sign in; sign-in returns roles; admin middleware rejects user; last-admin demote guard helper.
- [ ] Implement schema, sign-in checks, middleware, password route, boot promotion.
- [ ] Test green; existing 34 tests still pass.

### Task 3: Audit, jobs, maintenance

**Files:** connection models (`AuditLog`, `AdminJob`, `Setting`); create `server/config/admin/{audit,jobs,maintenance}.js`, `server/test/jobs.test.js`, `server/test/audit.test.js`.

**Interfaces:**
- `recordAudit({actorId, actorName, action, targetType, targetId, result, detail, ip})`.
- `enqueueJob(type, actor, payload): AdminJob`; runner concurrency 1; statuses queued/running/done/failed.
- `isMaintenance(): boolean`, `setMaintenance(bool, reason)`; public middleware answers 503 for all `/api/*` except `/api/health`, `/api/auth/*`, `/api/admin/*` while true.
- Boot marks interrupted jobs failed.

- [ ] Failing tests: maintenance blocks public reads/writes but not admin/health/auth; job lifecycle; interrupted job marked failed on boot function.
- [ ] Implement, including indexes for the new collections.
- [ ] Test green.

### Task 4: Backups, reset, restore

**Files:** create `server/config/admin/{backups,reset}.js`, `server/test/backups.test.js`; modify `server/config/database/connection.js` (no worker model).

**Interfaces:**
- `createBackup({trigger, actor}): {id, file, bytes, created_at}`; `listBackups(): row[]`; `pruneBackups(10)`.
- Wire format exactly `{format:"wdtct-backup", version:1, created_at, collections:{...}}` gzip.
- `resetCatalog(actor)`, `restoreBackup(id, actor)`: both require maintenance + backup first, recreate unique indexes, return job detail.
- Restore validates required collections before any write; writes to `tmp` collections then swaps.

- [ ] Failing tests: archive round trip; restore rejects archive missing `dish`; reset leaves users/audit/jobs; restore leaves accounts; indexes recreated; prune keeps 10.
- [ ] Implement and test green against a disposable test database/collection prefix.

### Task 5: Admin API and public health

**Files:** create `server/routes/api/admin.js`, `server/routes/api/health.js`; modify `server/app.js`, `docs/API.md`.

**Interfaces:** endpoints from the design table; every mutation writes audit and returns the job row; `GET /api/health` returns `{status:"ok", uptime_s}` only; `/api/admin/health` returns probes with 30 s translation cache.

- [ ] Failing route tests: 401/403, reset without confirm 400, restore unknown id 404, last-admin 409, users list/search, audit pagination, health payload shape (no user data).
- [ ] Implement routes; delete worker mount, spawn and `DATABASE_WORKER_EXE` usage.
- [ ] Test green; old routes unaffected.

### Task 6: Vue admin shell and Overview

**Files:** create `web_ui/src/views/admin/{admin_layout,admin_overview}.vue`, `web_ui/src/components/admin/{status_probe,job_table}.vue`; modify router, auth store, navbar, i18n files.

**Interfaces:** `/admin` + child routes; `requiresAdmin`; sign-in returns roles; hidden nav link; health poll 15 s paused when hidden.

- [ ] Failing unit tests: admin guard helper; i18n keys exist in both catalogues.
- [ ] Implement subnav, Overview status strip (four probes with lamp + actionable failure sentence), counts, recent jobs, maintenance banner.
- [ ] Vitest green; build green.

### Task 7: Jobs, Backups + Danger, Users, Audit, AI

**Files:** create `web_ui/src/views/admin/{admin_jobs,admin_backups,admin_users,admin_audit,admin_ai}.vue`, `web_ui/src/components/admin/{confirm_dialog,user_row}.vue`; i18n keys.

- [ ] Failing tests for pure helpers: job status label, currency/token formatting, last-admin UI guard.
- [ ] Implement each view per the shape brief; typed dialogs; download; temp-password modal; AI hidden until enabled.
- [ ] Vitest green; build green; 320 px and 1080 px layout checks via the probe harness.

### Task 8: Desktop kit

**Files:** `shared/DatabaseSeed.cs` (load `catalog/*.json`), `db_control/*` (command parser, exit codes, `--json`, `--yes`, health, backup/restore), `database_control_center/*` (remove Reception/Workspace worker, add console tabs), both `.csproj` (copy catalog as content), new `db_seed_tests/`.

**Interfaces:** CLI commands and options from the design; shared archive contract; WinForms uses the same services.

- [ ] Failing C# tests: catalog loader counts; backup archive reads a fixture produced by Node; usage error exit code 2; reset refuses without `--yes`.
- [ ] Implement CLI, then the console; delete worker code and packages.
- [ ] `dotnet test` green; publish command documented.

### Task 9: Docker Compose and docs

**Files:** `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.example`, README, ARCHITECTURE, DATA_MODEL, KNOWN_ISSUES, AGENTS.

- [ ] Compose: mongo healthcheck, server build stage (Vue then server), libretranslate en/vi, volumes `mongo-data`, `backups`, `public/gallery`; port 3000; no `directConnection`.
- [ ] Bring up from clean volumes; create admin; run reset; download backup; restore.
- [ ] Docs updated; worker references removed; migration note for deployments using `DATABASE_WORKER_EXE`.

### Task 10: Verification and record

- [ ] `server npm test`, `web_ui npx vitest run`, `dotnet test`, `flutter test`, both builds.
- [ ] `impeccable critique` on `/admin` after render; fix P0/P1; record.
- [ ] Implementation record with decisions, gaps, measurement table; commit.
