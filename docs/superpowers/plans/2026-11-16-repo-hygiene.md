# Repository Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the audited repository into a professional one: green CI, a license, real contribution docs, honest package metadata, and no stray template files. No behaviour change.

**Architecture:** Documentation, metadata and CI only. Each task is an independent commit; every task ends with the existing test suites (Node, Flutter, .NET) still passing. Source code is not refactored here; the deep-module work is a separate plan.

**Tech Stack:** Node 22, npm lockfile v3, Vue 3 + Vite, Flutter 3.32.8, .NET 9, GitHub Actions.

**Spec:** `docs/KNOWN_ISSUES.md` items 12-15 (repo cleanup) plus the rules in `AGENTS.md`.

## Global Constraints

- No change to API behaviour, client behaviour, or worker behaviour. Existing suites stay green: `server: npm test` (2 pass), `web_ui: npm run build` (succeeds), `flutter_web_dev: flutter test` (4 pass), both `dotnet build` (0 errors).
- No new runtime or dev dependency. This plan only removes dependencies.
- Do not commit `node_modules/`, `dist/`, `bin/`, `obj/`, `.vs/`, `.cxx/`, or any `.env`.
- CI runners: `ubuntu-latest` for Node and Flutter, `windows-latest` for .NET (`database_control_center` targets `net9.0-windows` with WinForms).
- Pinned versions: Node `22`, Flutter `3.32.8`, .NET `9.0.x`.
- License: MIT, copyright holder `doanxem99` (owner decision; change the holder string in Task 2 if wrong).
- Plan location convention: `docs/superpowers/plans/`.

## Review Focus

1. **Deleting the root `.docx` and `image.png` destroys files the owner may want.** They are committed, so history keeps them; state this in the commit body.
2. **Removing `eslint`/`prettier` from `server/package.json` breaks anyone running `npm run lint` by habit.** The scripts currently fail anyway (no config); the follow-up is a dedicated linting change, not a silent removal.
3. **`npm ci` fails when `package-lock.json` disagrees with `package.json`.** Task 3 must regenerate both locks and prove `npm ci` succeeds.
4. **`flutter analyze` exits 1 on info-level lints.** CI must use `--no-fatal-infos` or every build is red.
5. **A `windows-latest` .NET job cannot be replaced by ubuntu**; `UseWindowsForms` will not build there. Do not "optimise" it later.

---

### Task 1: Land the existing audit work

**Files:**
- Modify: nothing (git index only)

**Interfaces:**
- Consumes: the working tree left by the audit session (62 modified files, 324 staged deletions).
- Produces: a clean tree so CI, once added, measures the fixed code.

- [ ] **Step 1: Confirm what is uncommitted**

```bash
git status --short
```

Expected: modified source files, untracked `AGENTS.md`, `PRODUCT.md`, `docs/`, `server/.env.example`, `server/test/`, `.impeccable/`, and staged deletions of build output. `.impeccable/` is project config written by the design pass; it is committed here.

- [ ] **Step 2: Run the full verification before committing**

```bash
cd server && npm test
cd ../web_ui && npm run build
cd ../flutter_web_dev && flutter test
```

Expected: `# pass 2`, `✓ built`, `All tests passed!`. Stop and fix if any fails.

- [ ] **Step 3: Commit the audit work**

```bash
git add -A
git commit -m "fix: close audit findings and stop tracking generated files" -m "Server: auth on post creation, request-scoped user ids, empty-result hangs, path traversal guard, schema/log/worker fixes. Clients: correct API URLs and parsers, broken navigation. Data tools: job retry, log lock, real vote persistence, seed guards. Removes bin/obj/.vs/.cxx from the index; git history still holds them. Adds AGENTS.md, docs/ and server tests."
```

- [ ] **Step 4: Verify the tree is clean**

```bash
git status --short
```

Expected: no output.

---

### Task 2: Remove template leftovers, add license and editor defaults

**Files:**
- Delete: `package.json`, `index.html`, `style.css`, `image.png`, `Nấu gì hôm nay_250324_220826.sdocx`, `web_ui/text.txt`
- Create: `LICENSE`, `.editorconfig`, `.nvmrc`
- Modify: `web_ui/README.md`, `flutter_web_dev/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `LICENSE` referenced by both `package.json` files in Task 3; `.nvmrc` content `22`, matching the CI Node version.

- [ ] **Step 1: Prove nothing references the root template files**

```bash
git grep -n -e "Vue Chatter" -e "src/assets/logo.png" -e "text.txt"
```

Expected: only the files being deleted (`index.html`), no source or config references.

- [ ] **Step 2: Delete them**

```bash
git rm package.json index.html style.css image.png "Nấu gì hôm nay_250324_220826.sdocx" web_ui/text.txt
```

Expected: six `rm` lines; `git status --short` shows six deletions.

- [ ] **Step 3: Create `LICENSE`**

MIT text, first line `MIT License`, copyright line `Copyright (c) 2026 doanxem99`, standard body, no trailing changes.

- [ ] **Step 4: Create `.editorconfig`**

```
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,mjs,cjs,vue,json,yml,yaml,md,css,html}]
indent_style = space
indent_size = 2

[*.cs]
indent_style = space
indent_size = 4

[*.dart]
indent_style = space
indent_size = 2
```

- [ ] **Step 5: Create `.nvmrc` containing `22`**

- [ ] **Step 6: Replace the two template READMEs**

`web_ui/README.md`: 10 lines max — what the app is, `npm install`, `npm run dev` (5173), `npm run build`, link to `../docs/ARCHITECTURE.md`.
`flutter_web_dev/README.md`: 10 lines max — what the app is, `flutter pub get`, `flutter test`, `flutter build web`, note that `build/web/*` is copied into `server/web/`.

- [ ] **Step 7: Verify**

```bash
Test-Path package.json, index.html, style.css, image.png
git grep -n -e "Vue Chatter" -e "src/assets/logo.png"
```

Expected: four `False`; empty grep.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add license and editor defaults, drop template leftovers"
```

---

### Task 3: Fix package metadata and remove scripts that cannot run

**Files:**
- Modify: `server/package.json`, `server/package-lock.json`, `web_ui/package.json`, `web_ui/package-lock.json`, `flutter_web_dev/pubspec.yaml`

**Interfaces:**
- Consumes: `LICENSE` from Task 2.
- Produces: `npm test` (server) and `npm run build` (web_ui) remain the only commands CI uses.

- [ ] **Step 1: Edit `server/package.json`**

- `"name": "what-dish-to-cook-today-server"`
- add `"license": "MIT"`
- add `"engines": { "node": ">=22" }`
- delete the `"lint"` and `"format"` scripts (no ESLint config and no Prettier config exist; both commands fail today)
- delete devDependencies `eslint` and `prettier`
- keep `nodemon` and the `dev` script

- [ ] **Step 2: Edit `web_ui/package.json`**

- `"name": "what-dish-to-cook-today-web"`
- add `"private": true`, `"license": "MIT"`, `"engines": { "node": ">=22" }`
- keep existing scripts unchanged

- [ ] **Step 3: Edit `flutter_web_dev/pubspec.yaml`**

Replace `description: A new Flutter project.` with `description: Web client for What dish to cook today.`

- [ ] **Step 4: Regenerate both lockfiles**

```bash
cd server && npm install --package-lock-only
cd ../web_ui && npm install --package-lock-only
```

- [ ] **Step 5: Verify clean installs still work**

```bash
cd server && npm ci && npm test
cd ../web_ui && npm ci && npm run build
cd ../flutter_web_dev && flutter pub get && flutter test
```

Expected: `# pass 2`, `✓ built`, `All tests passed!`.

- [ ] **Step 6: Verify metadata**

```bash
cd server && npm pkg get name license engines
```

Expected: `what-dish-to-cook-today-server`, `MIT`, `{"node": ">=22"}`.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json web_ui/package.json web_ui/package-lock.json flutter_web_dev/pubspec.yaml flutter_web_dev/pubspec.lock
git commit -m "chore: real package metadata, drop unrunnable lint scripts"
```

---

### Task 4: CONTRIBUTING guide and README links

**Files:**
- Create: `CONTRIBUTING.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: commands verified in Task 3.
- Produces: `CONTRIBUTING.md` with the exact commands CI runs, so a contributor reproduces CI locally.

- [ ] **Step 1: Write `CONTRIBUTING.md`**

Sections, each 2-6 lines: setup (Node 22, MongoDB, `server/.env` from the example), the four verification commands from Task 3 Step 5 plus both `dotnet build` commands, branching (feature branch off `main`), commit style (`type: subject`, imperative, one concern per commit), and the rule that generated output (`server/web`, `dist`, `bin`, `obj`) is never committed. Link `AGENTS.md` and `docs/KNOWN_ISSUES.md`.

- [ ] **Step 2: Add two README lines**

Under `Documentation`, add `- [CONTRIBUTING.md](CONTRIBUTING.md) — how to build, test and commit`. Under a new short `License` heading, add `MIT. See [LICENSE](LICENSE).`

- [ ] **Step 3: Verify every link resolves**

```bash
Test-Path CONTRIBUTING.md, LICENSE, docs/ARCHITECTURE.md, docs/API.md, docs/DATA_MODEL.md, docs/KNOWN_ISSUES.md, AGENTS.md, PRODUCT.md
```

Expected: eight `True`.

- [ ] **Step 4: Commit**

```bash
git add CONTRIBUTING.md README.md
git commit -m "docs: add contributing guide and license link"
```

---

### Task 5: CI workflow and dependency updates

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`

**Interfaces:**
- Consumes: lockfiles from Task 3, commands from Task 4.
- Produces: four job names other docs refer to: `server`, `web`, `flutter`, `dotnet`.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

Trigger `push` and `pull_request` on `main`. `permissions: contents: read`.

Jobs:

`server` — `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22` and `cache: npm`, `cache-dependency-path: server/package-lock.json`; `working-directory: server`; steps: `npm ci`, `npm test`.

`web` — same runner and Node setup with `cache-dependency-path: web_ui/package-lock.json`; `working-directory: web_ui`; steps: `npm ci`, `npm run build`.

`flutter` — `ubuntu-latest`, checkout, `subosito/flutter-action@v2` with `flutter-version: 3.32.8`, `channel: stable`, `cache: true`; `working-directory: flutter_web_dev`; steps: `flutter pub get`, `flutter test`, `flutter analyze --no-fatal-infos`.

`dotnet` — `windows-latest`, checkout, `actions/setup-dotnet@v4` with `dotnet-version: 9.0.x`; steps: `dotnet build db_control/db_control/db_control.csproj`, `dotnet build database_control_center/database_control_center/database_control_center.csproj`.

- [ ] **Step 2: Write `.github/dependabot.yml`**

`version: 2`, weekly, four ecosystems with directories: `npm` for `/server` and `/web_ui`, `pub` for `/flutter_web_dev`, `nuget` for `/db_control/db_control` and `/database_control_center/database_control_center`, `github-actions` for `/`. Group each ecosystem's minor and patch updates into one pull request.

- [ ] **Step 3: Verify the workflow runs the same commands that pass locally**

```bash
cd server && npm ci && npm test
cd ../web_ui && npm ci && npm run build
cd ../flutter_web_dev && flutter pub get && flutter test && flutter analyze --no-fatal-infos
cd .. && dotnet build db_control/db_control/db_control.csproj && dotnet build database_control_center/database_control_center/database_control_center.csproj
```

Expected: `# pass 2`; `✓ built`; `All tests passed!`; analyze exits 0; two `Build succeeded`.

- [ ] **Step 4: Check the YAML is well formed**

Open both files and confirm: no tabs, every `uses:` pinned to a major tag, every `run` block has `working-directory` or a `cd`, job names match `server`, `web`, `flutter`, `dotnet`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/dependabot.yml
git commit -m "ci: test, build and analyze on every push"
```

---

### Task 6: Final verification and handover

**Files:**
- Modify: `docs/KNOWN_ISSUES.md` (item 12 and 13 status only)

**Interfaces:**
- Consumes: everything above.
- Produces: a tree where `git status` is clean and every suite is green.

- [ ] **Step 1: Mark the completed cleanup items**

In `docs/KNOWN_ISSUES.md`, delete item 13 (root template files) and update item 12 to say the index is clean while history still holds build output.

- [ ] **Step 2: Run everything once, from a clean state**

```bash
git status --short
cd server && npm ci && npm test
cd ../web_ui && npm ci && npm run build
cd ../flutter_web_dev && flutter test
cd .. && dotnet build db_control/db_control/db_control.csproj && dotnet build database_control_center/database_control_center/database_control_center.csproj
```

Expected: empty status; `# pass 2`; `✓ built`; `All tests passed!`; two `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add docs/KNOWN_ISSUES.md
git commit -m "docs: record completed repository cleanup"
```

---

## Follow-ups (not in this plan)

- Linting and formatting: one dedicated change adding an ESLint flat config to `server/` plus a Prettier config, then `npm run lint` in CI. Removed here because the scripts never ran and the fix produces a large diff.
- The deep-module refactor: result-to-HTTP seam and the shared posts module.
- Publishing: container image or systemd unit for the server, and a note on serving `server/web` versus `web_ui/dist`.
