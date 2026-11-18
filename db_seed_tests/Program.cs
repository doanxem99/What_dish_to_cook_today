using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using database_seed;
using db_control;

namespace db_seed_tests
{
    /// <summary>
    /// Offline self-check for the shared catalog loader, the backup archive contract and the
    /// command-line exit codes. Plain asserts: the machine may be offline, so no test framework.
    /// </summary>
    internal static class Program
    {
        private const string AdminId = "aaaaaaaaaaaaaaaaaaaaaaaa";
        private const string FixtureName = "backup-20261118-090232.json.gz";
        private static int failures;

        private static int Main()
        {
            var catalog = Catalog.Load();
            CheckCatalog(catalog);
            CheckSeedDocuments(catalog);
            CheckArchive();
            CheckArchiveRoundTrip(catalog);
            CheckCli();

            if (failures > 0)
            {
                Console.WriteLine($"{failures} check(s) failed.");
                return 1;
            }
            Console.WriteLine("ALL CHECKS PASSED");
            return 0;
        }

        private static void CheckCatalog(CatalogData catalog)
        {
            Check("catalog has 38 ingredients", catalog.Ingredients.Count == 38);
            Check("catalog has 13 dishes", catalog.Dishes.Count == 13);
            Check("catalog has nutrition for every ingredient", catalog.Nutrition.ElementCount == 38);

            var beef = catalog.Ingredients.First(row => row["name"].AsString == "Beef");
            Check("Beef keeps its Vietnamese name", beef["name_vi"].AsString == "Thịt bò");
            Check("Beef calories come from nutrition.json",
                beef["nutrition"]["per_100g"]["calories"].ToDouble() == 215);
            Check("Beef short detail is a catalog value",
                beef["short_detail"].AsString.Contains("phở"));

            var pho = catalog.Dishes.First(row => row["name"].AsString == "Beef noodle soup");
            Check("dish servings merge from dish-amounts.json", pho["servings"].ToDouble() == 4);
            Check("dish amounts merge from dish-amounts.json", pho["amounts"]["Beef"].ToDouble() == 400);
            Check("dish steps stay in order", pho["steps"].AsBsonArray.Count == 5);
            Check("dish image comes from dishes.json",
                pho["image"].AsString == "public/pictures/dishes/pho-bo.jpg");
        }

        private static void CheckSeedDocuments(CatalogData catalog)
        {
            var now = new DateTime(2026, 11, 18, 9, 2, 32, DateTimeKind.Utc);
            var seed = DatabaseSeed.BuildDocuments(AdminId, catalog, now);

            Check("seed writes 38 ingredients", seed.Ingredients.Count == 38);
            Check("seed writes 38 ingredient posts", seed.IngredientPosts.Count == 38);
            Check("seed writes 13 dishes", seed.Dishes.Count == 13);
            Check("seed writes 13 dish posts", seed.DishPosts.Count == 13);

            var ingredient = seed.Ingredients.First(row => row["name"].AsString == "Beef");
            var ingredientPost = seed.IngredientPosts.First(row => row["name"].AsString == "Beef");
            Check("ingredient best_post_id points at its post",
                ingredient["best_post_id"].AsString == ingredientPost["_id"].ToString());
            Check("ingredient post references its ingredient",
                ingredientPost["ingredient_id"].AsString == ingredient["_id"].ToString());
            Check("ingredient post is owned by the admin",
                ingredientPost["user_id"].AsString == AdminId);
            Check("ingredient post date is a BSON date",
                ingredientPost["date_time"].BsonType == BsonType.DateTime);

            var dish = seed.Dishes.First(row => row["name"].AsString == "Beef noodle soup");
            var dishPost = seed.DishPosts.First(row => row["name"].AsString == "Beef noodle soup");
            Check("dish post servings match the catalog", dishPost["servings"].ToDouble() == 4);
            Check("dish post nutrition calories match the JS seed",
                dishPost["nutrition"]["calories"].ToDouble() == 608);
            Check("dish post nutrition protein matches the JS seed",
                dishPost["nutrition"]["protein"].ToDouble() == 25.9);
            Check("dish post calories are int32 like the JS seed",
                dishPost["nutrition"]["calories"].BsonType == BsonType.Int32);
            Check("dish post protein stays a double",
                dishPost["nutrition"]["protein"].BsonType == BsonType.Double);
            Check("ingredient post points are int32 like the JS seed",
                ingredientPost["points"].BsonType == BsonType.Int32);
            Check("dish post amount rows carry the catalog grams",
                dishPost["ingredient_amounts"].AsBsonArray.Count == 7);
            Check("dish post image matches the catalog",
                dishPost["profile_image"].AsString == "public/pictures/dishes/pho-bo.jpg");
            Check("dish post lists every catalog ingredient",
                dishPost["ingredients"].AsBsonArray.Count == 7);
            Check("dish post display blocks come from the steps",
                dishPost["display_blocks"].AsBsonArray.Count == 5);

            var previousAdmin = Environment.GetEnvironmentVariable("ADMIN_USERNAME");
            try
            {
                Environment.SetEnvironmentVariable("ADMIN_USERNAME", " other@example.com ");
                Check("reset owner follows ADMIN_USERNAME",
                    DatabaseSeed.AdminUsername == "other@example.com");
                Environment.SetEnvironmentVariable("ADMIN_USERNAME", "");
                Check("reset owner falls back to the seed admin",
                    DatabaseSeed.AdminUsername == DatabaseSeed.DefaultAdminUsername);
            }
            finally
            {
                Environment.SetEnvironmentVariable("ADMIN_USERNAME", previousAdmin);
            }
        }

        private static void CheckArchive()
        {
            var path = Path.Combine(AppContext.BaseDirectory, "fixtures", FixtureName);
            var archive = BackupArchive.Read(path);

            Check("archive has the documented format", BackupArchive.Format == "wdtct-backup");
            Check("archive version is 1", BackupArchive.Version == 1);
            Check("fixture created_at is read", archive.CreatedAt.Year == 2026);
            Check("fixture keeps 38 ingredients", Count(archive, "ingredient") == 38);
            Check("fixture keeps 38 ingredient posts", Count(archive, "ingredient_post") == 38);
            Check("fixture keeps 13 dishes", Count(archive, "dish") == 13);
            Check("fixture keeps 13 dish posts", Count(archive, "dish_post") == 13);
            Check("fixture keeps the comment", Count(archive, "comment") == 1);
            Check("user rows are exported but ignored on restore",
                BackupArchive.ExportCollections.Contains("user")
                && !archive.Collections.ContainsKey("user"));

            var ingredient = archive.Collections["ingredient"][0];
            Check("archive keeps _id as a hex string", ingredient["_id"].BsonType == BsonType.String);
            Check("archive _id is 24 hex characters",
                Regex.IsMatch(ingredient["_id"].AsString, "^[0-9a-f]{24}$"));
            Check("archive best_post_id stays a hex string",
                ingredient["best_post_id"].BsonType == BsonType.String);
            Check("archive date_time is an ISO 8601 string",
                archive.Collections["ingredient_post"][0]["date_time"].BsonType == BsonType.String
                && Regex.IsMatch(archive.Collections["ingredient_post"][0]["date_time"].AsString,
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$"));
            Check("archive nutrition numbers survive",
                ingredient["nutrition"]["per_100g"]["calories"].ToDouble() == 215);
            Check("archive Vietnamese text survives", ingredient["name_vi"].AsString == "Thịt bò");

            var missing = RewriteFixture(json =>
            {
                json["collections"]!.AsObject().Remove("dish");
            });
            Check("archive missing dish is rejected", Throws(() => BackupArchive.Parse(missing),
                "Backup is missing collection dish"));
        }

        private static void CheckArchiveRoundTrip(CatalogData catalog)
        {
            var now = new DateTime(2026, 11, 18, 9, 2, 32, DateTimeKind.Utc);
            var seed = DatabaseSeed.BuildDocuments(AdminId, catalog, now);
            var source = new Dictionary<string, List<BsonDocument>>
            {
                ["ingredient"] = seed.Ingredients,
                ["ingredient_post"] = seed.IngredientPosts,
                ["dish"] = seed.Dishes,
                ["dish_post"] = seed.DishPosts,
                ["vote"] = new List<BsonDocument>(),
                ["comment"] = new List<BsonDocument>(),
                ["user"] = new List<BsonDocument>()
            };

            Check("default backup name is the UTC stamp the admin lists",
                BackupArchive.DefaultFileName(now) == FixtureName);

            var directory = Path.Combine(Path.GetTempPath(), "db_seed_tests-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            try
            {
                var first = BackupArchive.DefaultPath(directory, now);
                Check("default path uses the admin name", Path.GetFileName(first) == FixtureName);
                File.WriteAllText(first, "");
                Check("a taken default name gets a -1 suffix",
                    Path.GetFileName(BackupArchive.DefaultPath(directory, now))
                    == "backup-20261118-090232-1.json.gz");
            }
            finally
            {
                Directory.Delete(directory, true);
            }

            var parsed = BackupArchive.Parse(BackupArchive.Compose(now, source));
            Check("write then parse keeps the counts",
                Count(parsed, "ingredient") == 38 && Count(parsed, "ingredient_post") == 38
                && Count(parsed, "dish") == 13 && Count(parsed, "dish_post") == 13);
            Check("write then parse keeps created_at", parsed.CreatedAt == now);
            Check("write then parse keeps _id as a hex string",
                parsed.Collections["ingredient"][0]["_id"].BsonType == BsonType.String);
            Check("write then parse keeps date_time as an ISO string",
                parsed.Collections["ingredient_post"][0]["date_time"].BsonType == BsonType.String);
            var phoPost = parsed.Collections["dish_post"].First(row => row["name"].AsString == "Beef noodle soup");
            Check("write then parse keeps calories as int32",
                phoPost["nutrition"]["calories"].BsonType == BsonType.Int32
                && phoPost["nutrition"]["calories"].ToDouble() == 608);
        }

        private static void CheckCli()
        {
            Check("no command is a usage error", db_control.Program.Main(Array.Empty<string>()) == 2);
            Check("unknown command is a usage error", db_control.Program.Main(new[] { "bogus" }) == 2);
            Check("--help succeeds", db_control.Program.Main(new[] { "--help" }) == 0);
            Check("backup with a stray argument is a usage error",
                db_control.Program.Main(new[] { "backup", "extra" }) == 2);
            Check("restore without --file is a usage error",
                db_control.Program.Main(new[] { "restore" }) == 2);
            Check("recalc without an id is a usage error",
                db_control.Program.Main(new[] { "recalc-best-post" }) == 2);
            Check("recalc with a bad id is a usage error",
                db_control.Program.Main(new[] { "recalc-best-post", "nothex" }) == 2);

            var error = new StringWriter();
            var previous = Console.Error;
            Console.SetError(error);
            var code = db_control.Program.Main(new[] { "--json", "bogus" });
            Console.SetError(previous);
            Check("options before the command are parsed",
                code == 2 && error.ToString().Contains("Unknown command: bogus"));

            Check("init without --yes and redirected stdin is exit 2", ExitCode("init") == 2);
            Check("restore confirms before it checks the file",
                ExitCode("restore --file definitely-missing.json.gz") == 2);

            //BACKUP_DIR pointing at a file cannot hold the pre-reset archive, so init must refuse.
            var blocker = Path.Combine(Path.GetTempPath(), "db_seed_tests-blocked-" + Guid.NewGuid().ToString("N"));
            File.WriteAllText(blocker, "");
            try
            {
                Check("init aborts when the pre-reset backup cannot be written",
                    ExitCode("init --yes", ("BACKUP_DIR", blocker)) == 1);
            }
            finally
            {
                File.Delete(blocker);
            }

            Check("non-TTY without --yes must not run",
                !db_control.Program.CanProceed(yes: false, interactive: false));
            Check("TTY without --yes may prompt",
                db_control.Program.CanProceed(yes: false, interactive: true));
            Check("--yes runs without a TTY",
                db_control.Program.CanProceed(yes: true, interactive: false));
        }

        //Runs the built CLI with stdin closed, so a destructive command must refuse with exit 2.
        private static int ExitCode(string arguments, params (string Name, string Value)[] environment)
        {
            var exe = Path.Combine(AppContext.BaseDirectory,
                OperatingSystem.IsWindows() ? "db_control.exe" : "db_control");
            var start = new ProcessStartInfo(exe, arguments)
            {
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            foreach (var (name, value) in environment)
            {
                start.Environment[name] = value;
            }
            using var process = Process.Start(start)!;
            process.StandardInput.Close();
            process.StandardOutput.ReadToEnd();
            process.StandardError.ReadToEnd();
            process.WaitForExit();
            return process.ExitCode;
        }

        private static int Count(BackupArchiveData archive, string name)
        {
            return archive.Collections.TryGetValue(name, out var rows) ? rows.Count : -1;
        }

        private static byte[] RewriteFixture(Action<JsonObject> mutate)
        {
            var path = Path.Combine(AppContext.BaseDirectory, "fixtures", FixtureName);
            using var input = File.OpenRead(path);
            using var gunzip = new GZipStream(input, CompressionMode.Decompress);
            using var reader = new StreamReader(gunzip, Encoding.UTF8);
            var json = JsonNode.Parse(reader.ReadToEnd())!.AsObject();
            mutate(json);

            using var output = new MemoryStream();
            using (var gzip = new GZipStream(output, CompressionLevel.SmallestSize, leaveOpen: true))
            {
                var bytes = Encoding.UTF8.GetBytes(json.ToJsonString());
                gzip.Write(bytes, 0, bytes.Length);
            }
            return output.ToArray();
        }

        private static bool Throws(Action action, string messagePart)
        {
            try
            {
                action();
                return false;
            }
            catch (Exception error)
            {
                return error.Message.Contains(messagePart, StringComparison.Ordinal);
            }
        }

        private static void Check(string name, bool passed)
        {
            if (!passed)
            {
                failures += 1;
            }
            Console.WriteLine($"{(passed ? "PASS" : "FAIL")} {name}");
        }
    }
}
