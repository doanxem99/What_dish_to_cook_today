using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_seed
{
    /// <summary>The plain contents of one wdtct-backup archive.</summary>
    public sealed class BackupArchiveData
    {
        public BackupArchiveData(DateTime createdAt, IReadOnlyDictionary<string, List<BsonDocument>> collections)
        {
            CreatedAt = createdAt;
            Collections = collections;
        }

        public DateTime CreatedAt { get; }

        /// <summary>Documents in their archive form: ids are hex strings, date fields ISO strings.</summary>
        public IReadOnlyDictionary<string, List<BsonDocument>> Collections { get; }
    }

    public sealed class BackupInfo
    {
        public BackupInfo(string file, long bytes, DateTime createdAt, IReadOnlyDictionary<string, int> counts)
        {
            File = file;
            Bytes = bytes;
            CreatedAt = createdAt;
            Counts = counts;
        }

        public string File { get; }
        public long Bytes { get; }
        public DateTime CreatedAt { get; }
        public IReadOnlyDictionary<string, int> Counts { get; }
    }

    /// <summary>
    /// Reads and writes the backup contract shared with the Node server: gzip JSON
    /// {format:"wdtct-backup", version:1, created_at, collections}, ObjectIds as 24-char hex,
    /// dates as ISO 8601, user exported but never restored.
    /// </summary>
    public static class BackupArchive
    {
        public const string Format = "wdtct-backup";
        public const int Version = 1;

        /// <summary>The six collections a reset rebuilds and a restore may replace.</summary>
        public static readonly string[] CatalogCollections =
        {
            "ingredient", "ingredient_post", "dish", "dish_post", "vote", "comment"
        };

        /// <summary>user is exported for disaster recovery only; restore ignores it.</summary>
        public static readonly string[] ExportCollections = CatalogCollections.Concat(new[] { "user" }).ToArray();

        private static readonly Regex HexId = new Regex("^[0-9a-fA-F]{24}$", RegexOptions.CultureInvariant);
        private static readonly Regex Staging = new Regex("_restore_\\d+$", RegexOptions.CultureInvariant);

        public static BackupArchiveData Read(string path)
        {
            return Parse(File.ReadAllBytes(Path.GetFullPath(path)));
        }

        public static BackupArchiveData Parse(byte[] gzip)
        {
            string text;
            using (var input = new MemoryStream(gzip))
            using (var gunzip = new GZipStream(input, CompressionMode.Decompress))
            using (var reader = new StreamReader(gunzip, Encoding.UTF8))
            {
                text = reader.ReadToEnd();
            }

            var root = JsonNode.Parse(text)?.AsObject()
                ?? throw new InvalidOperationException("Not a wdtct-backup archive");
            if (root["format"]?.GetValue<string>() != Format)
            {
                throw new InvalidOperationException("Not a wdtct-backup archive");
            }
            var version = root["version"]?.GetValue<double>() ?? 0;
            if (version != Version)
            {
                throw new InvalidOperationException($"Unsupported backup version {version}");
            }
            var createdAt = root["created_at"]?.GetValue<string>()
                ?? throw new InvalidOperationException("Backup has no created_at");
            var source = root["collections"]?.AsObject()
                ?? throw new InvalidOperationException("Backup has no collections");

            var collections = new Dictionary<string, List<BsonDocument>>();
            foreach (var name in CatalogCollections)
            {
                if (source[name] is not JsonArray rows)
                {
                    throw new InvalidOperationException($"Backup is missing collection {name}");
                }

                var documents = new List<BsonDocument>();
                for (var index = 0; index < rows.Count; index += 1)
                {
                    if (rows[index] is not JsonObject)
                    {
                        throw new InvalidOperationException($"Backup collection {name} row {index} is not an object");
                    }
                    var document = JsonBson.ToPlainBson(rows[index]!).AsBsonDocument;
                    if (!document.TryGetValue("_id", out var id)
                        || id.BsonType != BsonType.String
                        || !HexId.IsMatch(id.AsString))
                    {
                        throw new InvalidOperationException($"Backup collection {name} row {index} has an invalid _id");
                    }
                    documents.Add(document);
                }
                collections[name] = documents;
            }

            return new BackupArchiveData(
                DateTime.Parse(createdAt, CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal),
                collections);
        }

        /// <summary>Writes exactly the given path, atomically: a crash leaves a .part file.</summary>
        public static BackupInfo Write(IMongoDatabase database, string path)
        {
            var fullPath = Path.GetFullPath(path);
            var directory = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var created = DateTime.UtcNow;
            var collections = new JsonObject();
            var counts = new Dictionary<string, int>();
            foreach (var name in ExportCollections)
            {
                var documents = database.GetCollection<BsonDocument>(name)
                    .Find(FilterDefinition<BsonDocument>.Empty)
                    .ToList();
                var rows = new JsonArray();
                foreach (var document in documents)
                {
                    rows.Add(JsonBson.ToJson(document));
                }
                collections[name] = rows;
                counts[name] = documents.Count;
            }

            var payload = new JsonObject
            {
                ["format"] = Format,
                ["version"] = Version,
                ["created_at"] = created.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture),
                ["collections"] = collections
            };
            var bytes = Gzip(Encoding.UTF8.GetBytes(payload.ToJsonString()));

            var partPath = fullPath + ".part";
            File.WriteAllBytes(partPath, bytes);
            File.Move(partPath, fullPath, overwrite: true);
            return new BackupInfo(fullPath, bytes.LongLength, created, counts);
        }

        /// <summary>
        /// Stages all six collections first, then swaps them in, so the target differs only for
        /// the short rename loop. Never touches user, role, audit_log or admin_job.
        /// </summary>
        public static void Restore(IMongoDatabase database, BackupArchiveData archive)
        {
            DropStaleStaging(database);
            var suffix = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var staged = new List<(string Name, string Temporary, List<BsonDocument> Documents)>();

            foreach (var name in CatalogCollections)
            {
                if (!archive.Collections.TryGetValue(name, out var rows))
                {
                    throw new InvalidOperationException($"Backup is missing collection {name}");
                }
                var documents = rows.Select(ToDatabaseDocument).ToList();
                var temporary = $"{name}_restore_{suffix}";
                database.DropCollection(temporary);
                database.CreateCollection(temporary);
                if (documents.Count > 0)
                {
                    database.GetCollection<BsonDocument>(temporary).InsertMany(documents);
                }
                staged.Add((name, temporary, documents));
            }

            foreach (var (name, temporary, documents) in staged)
            {
                try
                {
                    database.RenameCollection(temporary, name,
                        new RenameCollectionOptions { DropTarget = true });
                }
                catch (MongoCommandException error) when (IsRenameRefused(error))
                {
                    //shortcut: without admin rights the target is empty between drop and insert.
                    database.DropCollection(name);
                    if (documents.Count > 0)
                    {
                        database.GetCollection<BsonDocument>(name).InsertMany(documents);
                    }
                    database.DropCollection(temporary);
                }
            }

            DatabaseSeed.RecreateIndexes(database);
        }

        private static BsonDocument ToDatabaseDocument(BsonDocument document)
        {
            return JsonBson.ToDatabaseBson(JsonBson.ToJson(document)!).AsBsonDocument;
        }

        //13/26 is what MongoDB answers when the caller may not rename across namespaces.
        private static bool IsRenameRefused(MongoCommandException error)
        {
            return error.Code == 13 || error.Code == 26
                || error.CodeName == "Unauthorized" || error.CodeName == "NamespaceNotFound";
        }

        //A crash between staging and swap leaves temporary collections behind.
        private static void DropStaleStaging(IMongoDatabase database)
        {
            foreach (var name in database.ListCollectionNames().ToList())
            {
                if (Staging.IsMatch(name))
                {
                    database.DropCollection(name);
                }
            }
        }

        private static byte[] Gzip(byte[] bytes)
        {
            using var output = new MemoryStream();
            using (var gzip = new GZipStream(output, CompressionLevel.Optimal, leaveOpen: true))
            {
                gzip.Write(bytes, 0, bytes.Length);
            }
            return output.ToArray();
        }
    }
}
