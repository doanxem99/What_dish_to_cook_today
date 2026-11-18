# Admin operations implementation record

Date: 2026-11-18
Branch: `feat/admin-operations`
Base: `400cfbb` (approved design, plan and surface brief)
Design: [spec](../superpowers/specs/2026-11-18-admin-operations-design.md) · [plan](../superpowers/plans/2026-11-18-admin-operations.md) · [shape](../../.impeccable/surfaces/admin-operations.md)

## What shipped

| Area | Result |
|---|---|
| Catalog | One source at `catalog/`: ingredients (38), dishes (13), per-serving amounts, images, USDA nutrition. JS loader, admin reset and both .NET tools read the same files. |
| Identity | `admin` role, `is_disabled`, `must_change_password`; signed-in admins manage admins; last-admin and self-demotion guards; temporary passwords shown once and forced to change at next sign-in. |
| Operations | In-process job runner (concurrency 1, per-type timeouts, boot recovery), audit log on every mutation, maintenance mode that clears on success and failure. |
| Backups | One gzip JSON contract (`wdtct-backup` v1) written and read by Node and C#, newest 10 kept, atomic `.part` write, ids resolved from the listing only. |
| Reset / restore | Catalog-only: six collections dropped and reseeded; users, roles, audit, jobs and settings survive; restore validates every document before the first write and stages all six temp collections before swapping; unique indexes recreated. |
| Admin API | 14 endpoints plus public `/api/health`; real status codes; `{error:{code,message}}`; no hash, token or prompt text in any payload. |
| Web admin | `/admin` inside the Vue app, bilingual (206 keys), guarded, Overview strip plus Jobs, Backups with a Danger zone, Users, Audit, AI (hidden until configured). |
| Desktop kit | `db_control` CLI (`init`, `backup`, `restore`, `recalc-best-post`, `health`, `--uri`, `--db`, `--json`, `--yes`, exit codes 0/1/2), WinForms offline console (connection, health, operations, log), both on the shared catalog and archive. Worker protocol, WebSocket dependency and spawn path removed. |
| Deployment | `Dockerfile` (Vue build stage, non-root), `docker-compose.yml` (mongo, server, LibreTranslate, volumes, healthchecks), root `.env.example`, docs rewritten. |

## Decisions worth remembering

- Reset is catalog-only by design; accounts cannot be deleted through it.
- Backups include `user` rows for disaster export, but restore is catalog-only in v1.
- Audit and job rows are never archived, restored or mutated.
- The admin page is a second-level surface inside the existing board, not a new product.
- Popular numbers: the CLI and console default to `backup-YYYYMMDD-HHmmss.json.gz` because that is the only name pattern the admin page lists.
- CORS accepts only configured origins; the site's own origin must be listed because built assets send `Origin`.
- `must_change_password` is enforced by the Vue guard only; recorded as a known gap.

## Measurement

| Check | Before | After |
|---|---|---|
| Server tests | 34 | 137 |
| Web tests | 8 | 53 |
| Flutter tests | 75 | 75 (untouched) |
| .NET builds | 1 warning | 0 warnings, both projects |
| C# self-check | none | `db_seed_tests` all pass |
| Detector findings (admin source) | – | 0 |
| Critique score | – | 27/40, then P1/P2 fixes |

## Verification evidence

- Live Vue admin walk: Overview probes, Jobs empty state, Backups + typed RESET dialog (confirm enabled only on the exact word), Users with self-actions disabled, Audit rows.
- Docker: `up -d --build` on port 3100 → healthy mongo/server, `/` and `/admin` 200, own-origin asset 200, foreign origin 403, signup + boot promotion, admin health green, backup job done with the file on the volume, reset to 38/13/13, teardown with `-v`.
- Backup interop: C# archive parsed by Node without extended JSON; Node archive restored through the CLI and vice versa.
- Reset leaves accounts: demo sign-in returned 200 after a reset.

## Known gaps

- No browser screenshot of `/admin` at 320 px; responsive behaviour is verified from CSS, tests and a 390 px DOM measurement.
- Forced password change is client-enforced; a holder of a temporary password can still call the API.
- Restore aborts mid-swap if a unique index cannot be rebuilt (duplicate names in an archive); the pre-restore backup holds the previous data.
- Last-admin rollback is a post-check: it narrows, but does not close, a three-way race.
- `npm run dev` cannot serve `/public/i18n/*.json`, so raw keys render under Vite; the Express-served build is correct.
- AI metrics have no producer yet; the tab stays hidden until `AI_ENABLED`.
- Container image tags for mongo and LibreTranslate are pinned to major/minor, not digests.
- The admin mutation guard is an in-process mutex: correct for one server process, and a multi-instance deployment needs a database transaction.
- A handler that exceeds its timeout stays counted as running until it actually settles, so a truly hung handler blocks the queue instead of overlapping with it. That is the safe trade-off.
