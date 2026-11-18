# Desktop kit — implementation record

Goal: make `db_control` a real offline CLI and turn `database_control_center` into a console,
both sharing the canonical `catalog/*.json` seed and the gzip backup contract used by the server.

Plan: [docs/superpowers/plans/2026-11-18-admin-operations.md](../superpowers/plans/2026-11-18-admin-operations.md) Task 8.
Spec: [docs/superpowers/specs/2026-11-18-admin-operations-design.md](../superpowers/specs/2026-11-18-admin-operations-design.md) sections Backups, Canonical catalog, Desktop tools.

## Files

| Path | Responsibility |
|---|---|
| `shared/JsonBson.cs` | plain JSON <-> BSON conversion: ObjectId to hex, date fields to ISO, numbers to doubles |
| `shared/Catalog.cs` | resolve and load `catalog/*.json`, merge dish servings and amounts |
| `shared/DatabaseSeed.cs` | build the seed documents from the catalog, reset the six collections, recreate unique indexes |
| `shared/BackupArchive.cs` | read/write/validate the `wdtct-backup` v1 archive, stage and swap a restore |
| `shared/VoteBestPost.cs` | one ingredient's best-post recalculation, connection injected |
| `db_control/db_control/Program.cs` | command parser, exit codes, health, init, backup, restore, recalc |
| `db_seed_tests/` | console self-check with plain asserts and a non-zero exit |
| `database_control_center/.../MainForm.cs` | offline console: Connection, Health, Operations, Log tabs |
| `database_control_center/.../Program.cs` | start the form; no instance pipe, no worker args |
| `database_control_center/.../AppLog/AppLog.cs` | log file next to the executable, not the working directory |
| `README.md` | CLI and console usage, publish command |

Deleted: `Reception/`, `Workspace/`, `SingleInstanceApp/`, `MainForm.Designer.cs`,
`MainForm.resx`, the duplicate `Workspace/VoteBestPost/` file, `Websocket.Client`.

## Interfaces

```csharp
static class Catalog
{
    static string ResolveDirectory();          // catalog/ next to the exe, else walk up to the repo root
    static CatalogData Load(string directory); // throws with the missing file name
    static CatalogData Load();
}

sealed class CatalogData
{
    List<BsonDocument> Ingredients;            // raw catalog rows
    List<BsonDocument> Dishes;                 // servings and amounts merged from dish-amounts.json
    BsonDocument Nutrition;                    // nutrition.json -> ingredients
}

sealed class SeedDocuments
{
    List<BsonDocument> Ingredients, IngredientPosts, Dishes, DishPosts;
}

static class DatabaseSeed
{
    const string DatabaseName = "what_dish_to_cook_today";
    const string AdminUsername = "moonshine@gmail.com";
    static string ConnectionString(string uri = null);
    static SeedDocuments BuildDocuments(string adminId, CatalogData catalog, DateTime now);
    static BsonDocument RequireAdmin(IMongoDatabase database);
    static void Init(string connectionString, string databaseName = DatabaseName);
    static void RecreateIndexes(IMongoDatabase database);
}

sealed class BackupArchiveData
{
    DateTime CreatedAt;
    IReadOnlyDictionary<string, List<BsonDocument>> Collections; // six catalog collections
}

static class BackupArchive
{
    const string Format = "wdtct-backup";
    const int Version = 1;
    static readonly string[] CatalogCollections; // ingredient, ingredient_post, dish, dish_post, vote, comment
    static readonly string[] ExportCollections;  // catalog + user
    static BackupArchiveData Parse(byte[] gzip);
    static BackupArchiveData Read(string path);
    static BackupInfo Write(IMongoDatabase database, string path); // exact path, temp then rename
    static void Restore(IMongoDatabase database, BackupArchiveData archive);
}

static class IngredientVoteBestPost
{
    static bool Update(string ingredientId, string connectionString, string databaseName);
}
```

CLI: `init [--yes]`, `backup --out <file>`, `restore --file <file> [--yes]`,
`recalc-best-post <ingredient_id>`, `health`; globals `--uri`, `--db`, `--json`, `--yes`,
`--help`, `--version`. Exit 0 success, 1 failure, 2 usage. Non-TTY destructive run without
`--yes` is usage error 2.

## Task list

- [x] Self-check project exists and fails: catalog counts, nutrition, Vietnamese text, fixture parse, hex id, missing collection, usage exit 2. (First run failed on the missing APIs, as intended.)
- [x] `BackupArchive` parses the Node fixture and rejects a missing collection.
- [x] Catalog loader and seed documents match `dev-demo.mjs` / `reset.js` values.
- [x] CLI returns documented exit codes.
- [x] Both projects build; WinForms has no worker references.
- [x] Live check on a scratch database only.

## Decisions and deviations

- Two extra shared files: `Catalog.cs` (the loader the self-check exercises) and `JsonBson.cs`
  (the plain-JSON converter both the loader and the archive need). The brief's create list named
  `BackupArchive.cs`; splitting the loader out keeps seed building testable without a database.
- `VoteBestPost/IngredientVoteBestPost.cs` moved to `shared/VoteBestPost.cs` instead of being
  compile-linked from `db_control` into the WinForms project. The class keeps its behaviour and
  gains `(ingredientId, connectionString, databaseName)` so both tools can target any server.
  `VoteBestPostRequest.cs` is deleted: the offline tools have no request queue.
- `SingleInstanceApp/` is deleted with the worker. Its only job was forwarding command-line jobs
  to the WebSocket worker; the console now opens normally.
- The WinForms form is built in `MainForm.cs`; `MainForm.Designer.cs` and `MainForm.resx` are
  deleted because no design-time surface remains.
- CLI `restore` does not write its own safety backup; the console and the server route do. The
  CLI user is expected to run `backup --out` first, and the README says so.
- `init` and `restore` confirm before connecting, so a missing `--yes` on a non-TTY exits 2
  without touching MongoDB.
- The console refuses a reset before asking for a backup path when the admin account is absent.

## Verification

```text
$ dotnet run --project db_seed_tests
PASS catalog has 38 ingredients
PASS catalog has 13 dishes
...
PASS no command is a usage error
PASS unknown command is a usage error
PASS backup without --out is a usage error
PASS non-TTY without --yes must not run
PASS --yes runs without a TTY
ALL CHECKS PASSED

$ dotnet build db_control/db_control/db_control.csproj
Build succeeded. 0 Warning(s) 0 Error(s)

$ dotnet build database_control_center/database_control_center/database_control_center.csproj
Build succeeded. 0 Warning(s) 0 Error(s)
```

Live check on `wdtct_scratch_task8` only (the dev database was not opened):

- `health --json` returned the six counts and a ping latency.
- `init --yes` seeded 38 ingredients, 38 ingredient posts, 13 dishes, 13 dish posts.
- The unique indexes (`name_1`, `unique_id_1`, `user_id_1_dish_post_id_1`) were recreated.
- `backup --out` wrote a `wdtct-backup` v1 file with the six collections plus `user`; Node read
  it with no extended JSON, and the pho values were calories 608, protein 25.9, servings 4.
- After deleting all ingredients and corrupting one dish post, `restore` without `--yes` exited
  2 and changed nothing; with `--yes` it restored 38/38/13/13 and calories 608, with `_id` as an
  ObjectId and `date_time` as a Date again.
- The Node fixture (`backup-20261118-090232.json.gz`) restored through the CLI: 38/38/13/13/0/1,
  nutrition 608, Beef 215 calories, Vietnamese names intact.
- `recalc-best-post` picked the higher-point post and moved `best_post_id`; a bad id exited 2 and
  a missing ingredient exited 1.
- `init --yes` with the admin removed exited 1 and left the 38/13 data in place.
- The scratch database was dropped afterwards.
- The WinForms executable started and stayed open with the API untouched by the tool; a source
  grep found no WebSocket, worker URL, or HTTP client reference.

## Accepted risks

- `shortcut:` the CLI restore does not take its own safety backup; the console does, and the
  server route does. A CLI user must run `backup --out` first.
- `shortcut:` restore falls back to drop-and-insert when the server refuses a collection rename.
- `shortcut:` the console blocks the UI thread during database work; operations are short except
  restore on a large archive.
- The console is an internal operator tool, so it follows the OS control set with a compact,
  ruled layout rather than the web admin visual language.
