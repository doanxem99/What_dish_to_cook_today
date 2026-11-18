---
version: 1
slug: "admin-operations"
primary_target: "web_ui/src/views/admin"
related_targets: ["web_ui", "server"]
---

# Admin operations surface brief

Scope: the `/admin` area of the Vue client, visitor mode Operate, for signed-in admins only. Same visual world as `web-ui.md`; this is an instrument panel inside the existing board, not a new product.

## Job and audience

A signed-in admin, usually arriving for a 20-second glance: is the database up, is translation up, did last night's job fail, is there a backup. Occasionally they come to do a deliberate task: promote an admin, disable an account, create or restore a backup, reset the catalog during setup. They may be remote, on a laptop, in a hurry, and they are the person who gets paged when the site misbehaves.

## Outcome and proof

Primary understanding: healthy or not, and what changed recently. Primary actions: inspect a failed job, manage a user, take a backup. Dangerous actions are deliberate detours, never the first thing under the cursor. Success is an admin closing the page in under a minute knowing the system is fine, or knowing exactly which part is not.

Proof is real data only: live pings, actual collection counts, real job rows, real backup files. No decorative charts, no fabricated uptime, no green light without a probe behind it.

## Selected direction

THESIS: an operations board, not an admin template. One status strip answers "is it alive", a compact activity table answers "what happened", and work happens on dedicated tabs. Dense rows and tabular numbers, same as the market board; no dashboard card grid, no donut charts, no gradient hero.

STORY: glance → diagnose → act → confirm → verify. Every action ends with a visible job row or audit row, so the admin never wonders whether the click landed.

FIRST VIEWPORT: site header, then an admin subnav strip (Overview, Jobs, Backups, Users, AI, Audit) and, on Overview, a single status strip of four probes (Database, Translation, AI configured, Backup volume) followed by four compact counts and a five-row recent-jobs table with a "View all" link. No destructive control here; one quiet link to Backups.

FOCAL MOMENT: the status strip. Each probe is a named row with a lamp, a one-line value (latency, model count, path), and a timestamp; an unhealthy probe expands to one sentence naming the next action ("Check the mongo service in Docker Compose").

## Scope and boundaries

- Production-ready six views: Overview, Jobs, Backups, Users, AI (hidden until enabled), Audit.
- Bilingual EN/VI with the shared catalogue.
- Responsive: usable at 320 px (stacked, tables become rows), comfortable at 1080 px board width.
- Light and dark from existing tokens.
- Untouched: public site, catalog editors, dish pages, Flutter client.
- Anti-goals: no new chart library, no drag-and-drop dashboards, no modal stacks, no raw JSON textarea as the primary UI, no reset on Overview.

## States and ranges

- Realistic ranges: tens of users, hundreds of jobs, ten backups, six audit pages; pagination 25 rows.
- Loading: skeleton rows in tables, "checking" text on each probe, never a full-page spinner after first load.
- Empty: jobs empty reads "No jobs yet — the system is idle", not an error; backups empty offers Create backup; audit empty explains nothing has been done yet.
- Error: probe turns danger with one actionable sentence; job failure shows short code and a "Details" expansion with the server message.
- Permission: a non-admin who reaches `/admin` gets a clear 403 panel with a link home; signed-out gets sign-in with a return path.
- Maintenance: a persistent amber banner across the admin page while a reset/restore job runs, with the job phase and a link to it.
- Destructive dialogs: type `RESET` or `RESTORE`, show what will be deleted or replaced, and state that a backup is written first.
- Disabled account: user row shows a muted "Disabled" chip; actions remain for admins.
- Overflow: long emails, job details and backup names truncate with a title/tooltip; tables never force horizontal page scroll.

## Interaction and layout

- Overview: status strip; count row; recent jobs; secondary links. Health polls every 15 s, pauses when the tab is hidden.
- Jobs: filter by type and status, newest first, pagination; running jobs refresh every 2 s; retry only for failed operational jobs, never for restore.
- Backups: table of backups (created, size, trigger, download), Create backup button; below a separated Danger zone holding Reset and Restore.
- Users: search, table (name, email, role chip, status, joined, last action), promote/demote with last-admin guard surfaced inline, disable with confirm, temporary password modal showing the value once with a copy action.
- AI: hidden until `AI_ENABLED`; metrics table (time, model, latency, tokens in/out, cost, status) and a disable switch; no prompt text anywhere.
- Audit: immutable table, newest first, filter by action and actor.
- Feedback: a toast for every mutation; the affected row updates in place. Destructive completions link to the backup that was written.
- Keyboard: every action reachable by keyboard, visible focus ring, Escape closes dialogs, Enter confirms only when the typed word matches.

## Constraints and open decisions

- Vue 3 + existing board components and tokens; no component library or chart package.
- Admin routes use real HTTP status codes; the page renders 401/403/409 states explicitly.
- The subnav is a second-level navigation strip, not a second navbar; active state uses the amber underline like the main nav.
- Table rows are the dense `row-line` pattern, not cards; counts and tokens use tabular numerals.
- Open: exact pagination size (25 assumed) and whether audit export is CSV or JSON; decide during planning.
