# Admin review fixes (server side)

Implements the server findings of the whole-branch review on `feat/admin-operations`
(HEAD `90d46ac`). The .NET and Vue files belong to another agent.

## Goal

The admin job queue and the admin user guards stay safe while a handler runs past its
timeout, when two mutations race, and when a destructive step fails halfway.

## Files

| File | Change |
|---|---|
| `server/config/admin/jobs.js` | A timed-out handler keeps `busy` and maintenance until its promise settles. Failed releases are retried on each tick. |
| `server/config/admin/maintenance.js` | `releaseStaleMaintenance()` clears a flag whose owning job is terminal. |
| `server/config/admin/reset.js` | Catalog loaded and validated before the flag and the first drop; a restore attempts every rename and reports all failures; a failed reset/restore leaves the flag for the runner. |
| `server/routes/api/admin.js` | One in-process mutex serializes role/disabled mutations; successful backup-dir probe cached 60 s. |
| `server/routes/api/verifyToken.js` | A disabled account answers 401. |
| `server/test/jobs.test.js` | Timeout keeps the queue closed; stale-flag retry. |
| `server/test/backups.test.js` | Bad catalog leaves data untouched; failed rename still swaps the rest. |
| `server/test/admin_api.test.js` | Concurrent demote and disable keep one enabled admin. |
| `server/test/auth.test.js` | Disabled token rejected by `verifyToken`. |
| `.github/workflows/ci.yml` | Web job runs `npx vitest run`. |
| `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/KNOWN_ISSUES.md` | Match the code. |

## Interfaces

- `releaseStaleMaintenance(): Promise<boolean>` — exported from `maintenance.js`, called by
  `runNextJob()` when no handler is running.
- `withTimeout` rejects with an `Error` whose `timedOut` is `true`; no signature change.
- `runNextJob(timeoutMs)` still returns the job row, but for a timed-out handler it returns
  before the handler settles and releases later.

## Accepted risks

- The admin mutex is in-process only. A multi-instance deployment needs a database transaction;
  the comment above the mutex says so.
- A handler abandoned by the timeout is not cancelled. The queue stays closed until it settles,
  which can be long for a restore.

## Verification

```bash
npm test --prefix server
```

Expected: 131 existing tests plus the new ones, 0 failures.

## Result

`npm test --prefix server` → 137 tests, 137 pass, 0 fail. Six new tests: timeout keeps the
queue closed, stale-flag retry, concurrent demote/disable, disabled token rejected, broken
catalog leaves the data alone, one failed rename still swaps the rest.
