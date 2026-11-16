# Implementation record: repository hygiene

- **Goal:** make the repository professional — green CI, license, contribution docs, honest metadata, no template leftovers — with no behaviour change.
- **Plan:** `docs/superpowers/plans/2026-11-16-repo-hygiene.md`
- **Spec:** `docs/KNOWN_ISSUES.md` items 12-15, `AGENTS.md`
- **Branch:** `chore/repo-hygiene` (off `main`)

## Files and responsibilities

| File | Responsibility |
|---|---|
| `LICENSE` | MIT terms, holder `doanxem99` |
| `.editorconfig` | whitespace and encoding defaults for every editor |
| `.nvmrc` | local Node major version, `22` |
| `CONTRIBUTING.md` | setup, verification commands, commit style |
| `.github/workflows/ci.yml` | the four gates: server, web, flutter, dotnet |
| `.github/dependabot.yml` | weekly grouped updates |
| `server/package.json` | name, license, engines; drop unrunnable scripts |
| `web_ui/package.json` | name, private, license, engines |
| `flutter_web_dev/pubspec.yaml` | real description |
| `README.md`, `web_ui/README.md`, `flutter_web_dev/README.md` | point at the docs, no template text |

Deleted: root `package.json`, `index.html`, `style.css`, `image.png`, the `.docx` export, `web_ui/text.txt`.

## Interfaces produced

- npm scripts that CI calls: `server: npm test`, `web_ui: npm run build`. No others.
- CI job names: `server`, `web`, `flutter`, `dotnet`.
- Node version contract: `.nvmrc` = `22`, `engines.node` = `>=22`, CI `node-version: 22`.
- Flutter version contract: CI `flutter-version: 3.32.8` (installed locally: 3.32.8).

## Task list and the check that proves each

| Task | Proving check |
|---|---|
| 1. Land existing audit work | full suites green, `git status --short` empty |
| 2. Remove leftovers, add license/editor defaults | `Test-Path` four `False`, `git grep` empty |
| 3. Package metadata, drop dead scripts | `npm ci` succeeds in both, `npm pkg get` values match |
| 4. CONTRIBUTING and README links | eight link targets `True` |
| 5. CI and Dependabot | every CI command run locally, YAML reviewed |
| 6. Final verification | all suites green from clean installs, one docs commit |

## Verification commands (the gate)

```
cd server && npm ci && npm test                     -> # pass 2, # fail 0
cd web_ui && npm ci && npm run build                -> ✓ built
cd flutter_web_dev && flutter test                  -> All tests passed!
flutter analyze --no-fatal-infos                    -> exit 0
dotnet build db_control/db_control/db_control.csproj                              -> Build succeeded
dotnet build database_control_center/database_control_center/database_control_center.csproj -> Build succeeded
```

## Accepted risks and shortcuts

- `shortcut: no lint gate yet`, upgrade when a dedicated linting change lands. `lint`/`format` scripts were removed because no config exists for either; keeping them would make CI red or lie.
- `shortcut: history keeps build output`, upgrade with `git filter-repo` only if repository size matters. This pass only stops future tracking.
- `shortcut: no worktree`, work happens on a local branch because dependencies are installed in place and the plan touches no runtime code.
- Deleting the root `.docx` and `image.png` is recoverable from git history; stated in the commit body.

## Rulings

- Ruling: use this file as the ledger instead of `.superpowers/sdd/...` — the harness already keeps records in `docs/`, and a second hidden ledger duplicates it. Cost if wrong: nothing, both are scratch.
- Ruling: no unit tests for metadata/docs tasks — there is no executable seam; the verification commands above are the red/green gate (docs pre-exist? no, each command fails or the file is absent before its task). Cost if wrong: a typo in a doc survives.
- Ruling: commit the plan and this record before the audit commit, so the audit commit carries only code. Cost if wrong: history has one extra docs commit.
- Ruling: `eslint`/`prettier` removed rather than configured — configuring them produces a large diff and a separate review. Cost if wrong: contributors lose formatting tooling until the follow-up.

## Progress log

(appended per task)
