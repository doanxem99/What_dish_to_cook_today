using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using MongoDB.Bson;
using MongoDB.Driver;
using database_seed;

namespace db_control
{
    /// <summary>
    /// Offline repair kit. Every command works with only MongoDB reachable; the API server does
    /// not have to run. Exit codes: 0 success, 1 failure, 2 usage error.
    /// </summary>
    public class Program
    {
        public const string Version = "1.0.0";
        private const int Success = 0;
        private const int Failure = 1;
        private const int Usage = 2;

        public static int Main(string[] args)
        {
            try
            {
                return Run(args);
            }
            catch (UsageException error)
            {
                Console.Error.WriteLine(error.Message);
                Console.Error.WriteLine("Run db_control --help for usage.");
                return Usage;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine("error: " + error.Message);
                return Failure;
            }
        }

        /// <summary>Destructive commands need --yes or a terminal to type the word in.</summary>
        public static bool CanProceed(bool yes, bool interactive)
        {
            return yes || interactive;
        }

        private static int Run(string[] args)
        {
            if (args.Length == 0)
            {
                throw new UsageException("No command given.");
            }

            if (args.Contains("--help") || args.Contains("-h"))
            {
                PrintHelp();
                return Success;
            }
            if (args.Contains("--version"))
            {
                Console.WriteLine(Version);
                return Success;
            }

            var command = args[0];
            var options = ParseOptions(args.Skip(1).ToArray());
            return command switch
            {
                "init" => Init(options),
                "backup" => Backup(options),
                "restore" => Restore(options),
                "recalc-best-post" => RecalcBestPost(options),
                "health" => Health(options),
                _ => throw new UsageException("Unknown command: " + command)
            };
        }

        private static int Init(Options options)
        {
            ExpectPositionals(options, 0);
            var refusal = Confirm(options, "RESET");
            if (refusal != Success)
            {
                return refusal;
            }

            var database = Connect(options).Database;
            database_seed.DatabaseSeed.Init(options.UriOrDefault, options.DatabaseName);
            var counts = Counts(database);

            if (options.Json)
            {
                PrintJson(Result("init", database.DatabaseNamespace.DatabaseName, counts));
            }
            else
            {
                Console.WriteLine($"Seeded {database.DatabaseNamespace.DatabaseName} from the catalog.");
                PrintCounts(counts);
            }
            return Success;
        }

        private static int Backup(Options options)
        {
            ExpectPositionals(options, 0);
            if (string.IsNullOrWhiteSpace(options.Out))
            {
                throw new UsageException("backup needs --out <file>.");
            }

            var info = BackupArchive.Write(Connect(options).Database, options.Out);
            if (options.Json)
            {
                var result = Result("backup", null, info.Counts);
                result["file"] = info.File;
                result["bytes"] = info.Bytes;
                result["created_at"] = info.CreatedAt.ToString("O");
                PrintJson(result);
            }
            else
            {
                Console.WriteLine($"Wrote {info.File} ({info.Bytes} bytes).");
                PrintCounts(info.Counts);
            }
            return Success;
        }

        private static int Restore(Options options)
        {
            ExpectPositionals(options, 0);
            if (string.IsNullOrWhiteSpace(options.File))
            {
                throw new UsageException("restore needs --file <file>.");
            }
            if (!System.IO.File.Exists(options.File))
            {
                Console.Error.WriteLine("error: file not found: " + options.File);
                return Failure;
            }
            if (Confirm(options, "RESTORE") is var refused && refused != Success)
            {
                return refused;
            }

            var archive = BackupArchive.Read(options.File);
            var database = Connect(options).Database;
            BackupArchive.Restore(database, archive);

            var counts = archive.Collections.ToDictionary(row => row.Key, row => row.Value.Count);
            if (options.Json)
            {
                var result = Result("restore", database.DatabaseNamespace.DatabaseName, counts);
                result["created_at"] = archive.CreatedAt.ToString("O");
                PrintJson(result);
            }
            else
            {
                Console.WriteLine($"Restored {options.File} into {database.DatabaseNamespace.DatabaseName}.");
                PrintCounts(counts);
            }
            return Success;
        }

        private static int RecalcBestPost(Options options)
        {
            ExpectPositionals(options, 1);
            var ingredientId = options.Positionals[0];
            if (!ObjectId.TryParse(ingredientId, out _))
            {
                throw new UsageException("recalc-best-post needs a 24-character hex ingredient id.");
            }

            var updated = IngredientVoteBestPost.Update(ingredientId, options.UriOrDefault, options.DatabaseName);
            if (!updated)
            {
                Console.Error.WriteLine("error: ingredient or posts not found: " + ingredientId);
                return Failure;
            }

            if (options.Json)
            {
                var result = new BsonDocument { { "ok", true }, { "ingredient_id", ingredientId } };
                PrintJson(result);
            }
            else
            {
                Console.WriteLine("Recalculated best post for " + ingredientId + ".");
            }
            return Success;
        }

        private static int Health(Options options)
        {
            ExpectPositionals(options, 0);
            var (_, database) = Connect(options);
            var stopwatch = Stopwatch.StartNew();
            database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            stopwatch.Stop();
            var counts = Counts(database);

            if (options.Json)
            {
                var result = Result("health", database.DatabaseNamespace.DatabaseName, counts);
                result["ping_ms"] = (long)Math.Round(stopwatch.Elapsed.TotalMilliseconds);
                PrintJson(result);
            }
            else
            {
                Console.WriteLine("database: " + database.DatabaseNamespace.DatabaseName);
                Console.WriteLine("ping_ms: " + Math.Round(stopwatch.Elapsed.TotalMilliseconds, 1));
                PrintCounts(counts);
            }
            return Success;
        }

        private static int Confirm(Options options, string word)
        {
            if (!CanProceed(options.Yes, !Console.IsInputRedirected))
            {
                Console.Error.WriteLine(
                    $"{word} confirmation required: pass --yes or run in a terminal and type {word}.");
                return Usage;
            }
            if (options.Yes)
            {
                return Success;
            }

            Console.Error.Write($"Type {word} to continue: ");
            var typed = Console.ReadLine();
            if (!string.Equals(typed?.Trim(), word, StringComparison.OrdinalIgnoreCase))
            {
                Console.Error.WriteLine("Aborted.");
                return Failure;
            }
            return Success;
        }

        private static (MongoClient Client, IMongoDatabase Database) Connect(Options options)
        {
            var settings = MongoClientSettings.FromConnectionString(options.UriOrDefault);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
            var client = new MongoClient(settings);
            return (client, client.GetDatabase(options.DatabaseName));
        }

        private static Dictionary<string, int> Counts(IMongoDatabase database)
        {
            return BackupArchive.CatalogCollections.ToDictionary(
                name => name,
                name => (int)database.GetCollection<BsonDocument>(name)
                    .CountDocuments(FilterDefinition<BsonDocument>.Empty));
        }

        private static BsonDocument Result(string command, string? database, IReadOnlyDictionary<string, int> counts)
        {
            var row = new BsonDocument { { "ok", true }, { "command", command } };
            if (database != null)
            {
                row["database"] = database;
            }
            var collectionCounts = new BsonDocument();
            foreach (var pair in counts)
            {
                collectionCounts[pair.Key] = pair.Value;
            }
            row["collections"] = collectionCounts;
            return row;
        }

        private static void PrintCounts(IReadOnlyDictionary<string, int> counts)
        {
            foreach (var pair in counts)
            {
                Console.WriteLine($"{pair.Key}: {pair.Value}");
            }
        }

        private static void PrintJson(BsonDocument document)
        {
            Console.WriteLine(JsonBson.ToJson(document)!.ToJsonString());
        }

        private static void ExpectPositionals(Options options, int count)
        {
            if (options.Positionals.Count != count)
            {
                throw new UsageException(count == 0
                    ? "This command takes no arguments."
                    : $"This command needs {count} argument(s).");
            }
        }

        private static Options ParseOptions(string[] args)
        {
            var options = new Options();
            for (var index = 0; index < args.Length; index += 1)
            {
                var arg = args[index];
                switch (arg)
                {
                    case "--uri":
                        options.Uri = NextValue(args, ref index, arg);
                        break;
                    case "--db":
                        options.Database = NextValue(args, ref index, arg);
                        break;
                    case "--out":
                        options.Out = NextValue(args, ref index, arg);
                        break;
                    case "--file":
                        options.File = NextValue(args, ref index, arg);
                        break;
                    case "--json":
                        options.Json = true;
                        break;
                    case "--yes":
                        options.Yes = true;
                        break;
                    default:
                        if (arg.StartsWith("-", StringComparison.Ordinal))
                        {
                            throw new UsageException("Unknown option: " + arg);
                        }
                        options.Positionals.Add(arg);
                        break;
                }
            }
            return options;
        }

        private static string NextValue(string[] args, ref int index, string option)
        {
            if (index + 1 >= args.Length)
            {
                throw new UsageException(option + " needs a value.");
            }
            index += 1;
            return args[index];
        }

        private static void PrintHelp()
        {
            Console.WriteLine($@"db_control {Version} - offline repair kit

Usage:
  db_control init [--yes]
  db_control backup --out <file>
  db_control restore --file <file> [--yes]
  db_control recalc-best-post <ingredient_id>
  db_control health

Global options:
  --uri <uri>   MongoDB URI (default MONGODB_URI, then mongodb://localhost:27017)
  --db <name>   Database name (default what_dish_to_cook_today)
  --json        Print one JSON object
  --yes         Skip the typed RESET/RESTORE confirmation
  --help        Show this help
  --version     Show the version

Exit codes: 0 success, 1 failure, 2 usage error.
init and restore are destructive: pass --yes or type RESET/RESTORE in a terminal.
backup --out writes the same gzip contract the admin page restores.");
        }

        private sealed class Options
        {
            public string? Uri { get; set; }
            public string? Database { get; set; }
            public string? Out { get; set; }
            public string? File { get; set; }
            public bool Json { get; set; }
            public bool Yes { get; set; }
            public List<string> Positionals { get; } = new List<string>();

            public string UriOrDefault => database_seed.DatabaseSeed.ConnectionString(Uri);

            public string DatabaseName => string.IsNullOrWhiteSpace(Database)
                ? database_seed.DatabaseSeed.DatabaseName
                : Database!;
        }

        private sealed class UsageException : Exception
        {
            public UsageException(string message) : base(message)
            {
            }
        }
    }
}
