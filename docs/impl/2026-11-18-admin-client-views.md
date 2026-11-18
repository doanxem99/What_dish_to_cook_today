# Admin client views — implementation record

Goal: ship the five remaining admin views (Jobs, Backups + Danger, Users, Audit, AI) on the
existing board, with one shared typed-confirm dialog, per-mutation toasts and full EN/VI copy.

Plan: [docs/superpowers/plans/2026-11-18-admin-operations.md](../superpowers/plans/2026-11-18-admin-operations.md) Task 7.
Shape: [.impeccable/surfaces/admin-operations.md](../../.impeccable/surfaces/admin-operations.md).
API: [docs/API.md](../API.md) Admin section.

## Files

| Path | Responsibility |
|---|---|
| `web_ui/src/components/admin/admin_format.js` | pure helpers: job labels, byte/cost/token format, typed-word match, filter params, row guard, error kind |
| `web_ui/src/components/admin/admin_format.test.js` | unit tests for those helpers |
| `web_ui/src/components/admin/admin_toast.js` | reactive toast list with auto-dismiss |
| `web_ui/src/components/admin/admin_toast.vue` | toast host rendered by the admin layout |
| `web_ui/src/components/admin/confirm_dialog.vue` | native `<dialog>` confirm, optional typed word, shared by reset and restore |
| `web_ui/src/components/admin/user_row.vue` | one user row: role chip, disabled chip, inline conflict note, actions |
| `web_ui/src/views/admin/admin_jobs.vue` | filters, pager, 2 s poll while a job is active, expansion, retry |
| `web_ui/src/views/admin/admin_backups.vue` | backup table, create, download, danger zone with reset/restore |
| `web_ui/src/views/admin/admin_users.vue` | search, promote/demote, disable/enable, temporary password modal |
| `web_ui/src/views/admin/admin_audit.vue` | immutable table with action/actor filters and pager |
| `web_ui/src/views/admin/admin_ai.vue` | metrics table from reserved job fields, guarded by `health.ai.configured` |
| `web_ui/src/views/admin/admin_layout.vue` | real subnav routes, single health poller provided to children, maintenance banner, toast host |
| `web_ui/src/views/admin/admin_overview.vue` | consume the layout health poller, drop its duplicate timer and banner |
| `web_ui/src/components/admin/job_table.vue` | optional detail column, expansion of error/payload, retry action |
| `web_ui/src/router/index.js` | five child routes and page titles |
| `server/routes/api/admin.js` | health maintenance gains `job_id` (`owner_job_id`) |
| `server/test/admin_api.test.js` | asserts `job_id` in the maintenance payload |
| `server/public/i18n/en.json`, `vi.json` | every new string |

## Interfaces

```js
jobTypeLabel(value, translate) -> string
jobStatusLabel(value, translate) -> string
formatBytes(bytes) -> string           // "0 B", "12.3 KB", "—" for unusable input
formatCost(value) -> string            // "$0.0042", "—"
formatTokens(value) -> string          // "12,400", "—"
typedWordMatches(typed, word) -> boolean  // trimmed, case-insensitive
filterQuery(source) -> object          // drops undefined/null/''
rowGuard(row, { currentUserId, currentUsername, enabledAdmins }) -> '' | 'self' | 'last_admin'
errorKind(error) -> 'unauthorized' | 'forbidden' | 'conflict' | 'server' | 'request' | 'network'
hasActiveJobs(rows) -> boolean
```

## Decisions

- Single health poller lives in `admin_layout.vue` and is provided to children. Overview reads it
  through `inject`; two 15 s pollers would double the backup-directory probe on the overview.
- The AI switch renders disabled with a truthful note: this release has no AI provider and no API
  route to disable one. The tab and table are real; the control activates with the provider.
- Audit action filter is exact text because `GET /api/admin/audit` compares `action` exactly
  (docs/API.md). The field carries a hint saying so.
- Backups rows carry no trigger/actor today (`listBackups` returns file metadata only); the Source
  column renders `—` and its header is hidden when no row has one.
- Temporary password lives in view state only and is dropped when the dialog closes.

## Verification

- `cd web_ui; npx vitest run` — 5 files, 40 tests pass (20 of them the new helper suite).
- `cd web_ui; npm run build` — exits 0; the tracked `server/web_ui` output is refreshed.
- `cd server; npm test` — 124 tests pass, including the two maintenance `job_id` assertions.

Live check against `node scripts/dev-demo.mjs` (`ADMIN_USERNAME=demo`) with the Vite dev
server: sign-in returned `roles=user,admin`; `GET /api/admin/health` reported the database up and
the backup directory writable; `POST /api/admin/backup` queued and finished, and the archive
appeared in `GET /api/admin/backups` (11,149 bytes, download answered 200). A `POST
/api/admin/reset` restored 38 ingredients and 13 dishes, wrote a backup first, answered 409 to a
second concurrent request, and left an audit row. The browser harness reported
`[browser.disconnected]`, so no rendered screenshot at 320 px or 1080 px was captured; layout is
covered by the shared stacked-row CSS and the production build.

## Deviations

- The AI disable switch is rendered disabled with a note. The release has no AI provider and no
  route that could persist the switch; faking a mutation would be worse than saying so.
- The audit action filter matches the exact action name, as `GET /api/admin/audit` requires; the
  field and a hint state this. Actor stays free text because the endpoint treats it as a pattern.
- Backups rows carry no trigger or actor today (`listBackups` reads file metadata), so the Source
  column only appears if a row ever carries one.

## Shortcut

`shortcut: AI switch is display-only until an AI provider adds a disable route`, revisit with that provider.
