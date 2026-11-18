using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using MongoDB.Bson;

namespace database_seed
{
    /// <summary>The canonical catalog, loaded from the repository's catalog/*.json files.</summary>
    public sealed class CatalogData
    {
        public CatalogData(List<BsonDocument> ingredients, List<BsonDocument> dishes, BsonDocument nutrition)
        {
            Ingredients = ingredients;
            Dishes = dishes;
            Nutrition = nutrition;
        }

        /// <summary>Rows of ingredients.json, unchanged.</summary>
        public List<BsonDocument> Ingredients { get; }

        /// <summary>Rows of dishes.json with servings and amounts merged from dish-amounts.json.</summary>
        public List<BsonDocument> Dishes { get; }

        /// <summary>The ingredients map of nutrition.json, keyed by ingredient name.</summary>
        public BsonDocument Nutrition { get; }
    }

    /// <summary>
    /// Finds and reads the same catalog the JS server uses. The path never depends on the
    /// working directory: the folder next to the executable wins, then a parent (repo root).
    /// </summary>
    public static class Catalog
    {
        public static string ResolveDirectory()
        {
            foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
            {
                var directory = new DirectoryInfo(start);
                for (var depth = 0; depth < 8 && directory != null; depth += 1, directory = directory.Parent)
                {
                    var candidate = Path.Combine(directory.FullName, "catalog");
                    if (File.Exists(Path.Combine(candidate, "ingredients.json")))
                    {
                        return candidate;
                    }
                }
            }
            throw new DirectoryNotFoundException(
                "catalog/ingredients.json was not found next to the executable or in a parent folder.");
        }

        public static CatalogData Load()
        {
            return Load(ResolveDirectory());
        }

        public static CatalogData Load(string directory)
        {
            var ingredients = ReadArray(directory, "ingredients.json")
                .Select(row => row.AsBsonDocument)
                .ToList();
            var dishesJson = ReadArray(directory, "dishes.json");
            var amounts = ReadObject(directory, "dish-amounts.json");
            var nutrition = ReadObject(directory, "nutrition.json")["ingredients"].AsBsonDocument;

            var mergedDishes = new List<BsonDocument>();
            foreach (var dish in dishesJson)
            {
                var document = dish.AsBsonDocument;
                var name = document["name"].AsString;
                if (amounts.TryGetValue(name, out var entry) && entry.IsBsonDocument)
                {
                    var amountEntry = entry.AsBsonDocument;
                    document["servings"] = amountEntry.TryGetValue("servings", out var servings)
                        ? servings
                        : BsonNull.Value;
                    document["amounts"] = amountEntry.TryGetValue("amounts", out var grams)
                        ? grams
                        : new BsonDocument();
                }
                else
                {
                    document["servings"] = BsonNull.Value;
                    document["amounts"] = new BsonDocument();
                }
                mergedDishes.Add(document);
            }

            return new CatalogData(ingredients, mergedDishes, nutrition);
        }

        private static BsonArray ReadArray(string directory, string name)
        {
            return (BsonArray)JsonBson.ToPlainBson(ReadJson(directory, name));
        }

        private static BsonDocument ReadObject(string directory, string name)
        {
            return JsonBson.ToPlainBson(ReadJson(directory, name)).AsBsonDocument;
        }

        private static JsonNode ReadJson(string directory, string name)
        {
            var path = Path.Combine(directory, name);
            if (!File.Exists(path))
            {
                throw new FileNotFoundException("Catalog file is missing: " + path, path);
            }
            return JsonNode.Parse(File.ReadAllText(path))!;
        }
    }
}
