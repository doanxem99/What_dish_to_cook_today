using System;
using System.Collections.Generic;
using System.Linq;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_seed
{
    /// <summary>The documents a catalog reset writes, built before any collection is touched.</summary>
    public sealed class SeedDocuments
    {
        public SeedDocuments(
            List<BsonDocument> ingredients,
            List<BsonDocument> ingredientPosts,
            List<BsonDocument> dishes,
            List<BsonDocument> dishPosts)
        {
            Ingredients = ingredients;
            IngredientPosts = ingredientPosts;
            Dishes = dishes;
            DishPosts = dishPosts;
        }

        public List<BsonDocument> Ingredients { get; }
        public List<BsonDocument> IngredientPosts { get; }
        public List<BsonDocument> Dishes { get; }
        public List<BsonDocument> DishPosts { get; }
    }

    /// <summary>
    /// Shared catalog reset used by both database tools. It requires the admin user, checks it
    /// before dropping anything, and seeds the canonical catalog/*.json exactly like the JS reset.
    /// </summary>
    public static class DatabaseSeed
    {
        public const string DatabaseName = "what_dish_to_cook_today";
        public const string AdminUsername = "moonshine@gmail.com";

        private static readonly string[] CatalogCollections =
        {
            "ingredient", "ingredient_post", "dish", "dish_post", "vote", "comment"
        };

        public static void Init(string connectionString, string databaseName = DatabaseName)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("MongoDB connection string is empty.");
            }

            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            // Resolve the admin before any collection is dropped.
            var admin = RequireAdmin(database);
            var adminId = admin.GetValue("_id").ToString()!;
            var seed = BuildDocuments(adminId, Catalog.Load(), DateTime.UtcNow);

            foreach (var name in CatalogCollections)
            {
                database.DropCollection(name);
                database.CreateCollection(name);
            }

            Insert(database, "ingredient", seed.Ingredients);
            Insert(database, "ingredient_post", seed.IngredientPosts);
            Insert(database, "dish", seed.Dishes);
            Insert(database, "dish_post", seed.DishPosts);
            RecreateIndexes(database);
        }

        /// <summary>Throws when the admin account is absent, before any destructive work.</summary>
        public static BsonDocument RequireAdmin(IMongoDatabase database)
        {
            var admin = database.GetCollection<BsonDocument>("user")
                .Find(Builders<BsonDocument>.Filter.Eq("username", AdminUsername))
                .FirstOrDefault();
            if (admin == null)
            {
                throw new InvalidOperationException($"User {AdminUsername} must exist before data init.");
            }
            return admin;
        }

        /// <summary>Builds the exact documents scripts/dev-demo.mjs and the JS reset write.</summary>
        public static SeedDocuments BuildDocuments(string adminId, CatalogData catalog, DateTime now)
        {
            var ingredientIds = new Dictionary<string, string>();
            var ingredients = new List<BsonDocument>();
            var ingredientPosts = new List<BsonDocument>();

            foreach (var row in catalog.Ingredients)
            {
                var name = row["name"].AsString;
                var nameVi = row["name_vi"].AsString;
                var ingredientId = ObjectId.GenerateNewId();
                var postId = ObjectId.GenerateNewId();
                ingredientIds[name] = ingredientId.ToString();

                ingredients.Add(new BsonDocument
                {
                    { "_id", ingredientId },
                    { "name", name },
                    { "name_vi", nameVi },
                    { "best_post_id", postId.ToString() },
                    { "nutrition", Field(row, "nutrition") },
                    { "is_need_update", false }
                });

                ingredientPosts.Add(new BsonDocument
                {
                    { "_id", postId },
                    { "name", name },
                    { "name_vi", nameVi },
                    { "user_id", adminId },
                    { "ingredient_id", ingredientId.ToString() },
                    { "unique_id", $"{ingredientId}_{adminId}" },
                    { "is_best_post", true },
                    { "date_time", new BsonDateTime(now) },
                    { "points", new BsonDouble(0) },
                    { "type", Field(row, "type") },
                    { "nutrition", Field(row, "nutrition") },
                    { "short_detail", Field(row, "short_detail") },
                    { "short_detail_vi", Field(row, "short_detail_vi") },
                    { "profile_image", Field(row, "image", "") },
                    { "display_blocks", new BsonArray
                        {
                            new BsonDocument
                            {
                                { "type", "text" },
                                { "text", $"{name} is kept in the shared catalog so every cook means the same thing." },
                                { "text_vi", $"{nameVi} được lưu trong danh mục chung để mọi người hiểu cùng một nghĩa." },
                                { "font_size", new BsonDouble(14) },
                                { "color", "black" }
                            }
                        }
                    }
                });
            }

            var dishes = new List<BsonDocument>();
            var dishPosts = new List<BsonDocument>();
            foreach (var row in catalog.Dishes)
            {
                var name = row["name"].AsString;
                var dishId = ObjectId.GenerateNewId();
                var postId = ObjectId.GenerateNewId();
                var amounts = Field(row, "amounts", new BsonDocument()).AsBsonDocument;
                var servings = Servings(row);
                var ingredientAmounts = new BsonArray();
                foreach (var amount in amounts)
                {
                    if (ingredientIds.TryGetValue(amount.Name, out var ingredientId))
                    {
                        ingredientAmounts.Add(new BsonDocument
                        {
                            { "ingredient_id", ingredientId },
                            { "grams", amount.Value }
                        });
                    }
                }

                dishes.Add(new BsonDocument
                {
                    { "_id", dishId },
                    { "name", name },
                    { "name_vi", row["name_vi"].AsString },
                    { "best_post_id", postId.ToString() },
                    { "is_need_update", false }
                });

                dishPosts.Add(new BsonDocument
                {
                    { "_id", postId },
                    { "name", name },
                    { "name_vi", row["name_vi"].AsString },
                    { "user_id", adminId },
                    { "dish_id", dishId.ToString() },
                    { "unique_id", $"{dishId}_{adminId}" },
                    { "is_best_post", true },
                    { "date_time", new BsonDateTime(now) },
                    { "points", new BsonDouble(0) },
                    { "views", new BsonDouble(0) },
                    { "comments", new BsonDouble(0) },
                    { "ingredients", new BsonArray(row["ingredients"].AsBsonArray
                        .Select(value => ingredientIds.TryGetValue(value.AsString, out var id)
                            ? (BsonValue)new BsonString(id)
                            : BsonNull.Value)
                        .Where(value => !value.IsBsonNull)) },
                    { "short_detail", Field(row, "short_detail", "") },
                    { "short_detail_vi", Field(row, "short_detail_vi", "") },
                    { "profile_image", Field(row, "image", "") },
                    { "servings", servings },
                    { "nutrition", RecipeNutrition(amounts, servings, catalog.Nutrition) },
                    { "ingredient_amounts", ingredientAmounts },
                    { "display_blocks", DisplayBlocks(row) }
                });
            }

            return new SeedDocuments(ingredients, ingredientPosts, dishes, dishPosts);
        }

        /// <summary>Same nutrition maths as scripts/dev-demo.mjs and the JS reset.</summary>
        public static BsonDocument RecipeNutrition(BsonDocument amounts, BsonValue servings, BsonDocument nutrition)
        {
            var names = new[] { "calories", "protein", "fat", "carbs", "fiber", "sodium" };
            var totals = names.ToDictionary(name => name, name => 0.0);

            foreach (var amount in amounts)
            {
                if (!nutrition.TryGetValue(amount.Name, out var row) || !row.IsBsonDocument
                    || !row.AsBsonDocument.TryGetValue("per_100g", out var per100))
                {
                    continue;
                }
                var grams = amount.Value.ToDouble();
                foreach (var name in names)
                {
                    if (per100.AsBsonDocument.TryGetValue(name, out var nutrient))
                    {
                        totals[name] += nutrient.ToDouble() * grams / 100;
                    }
                }
            }

            var portions = servings.IsBsonNull ? 1 : servings.ToDouble();
            if (portions == 0)
            {
                portions = 1;
            }

            var result = new BsonDocument();
            foreach (var name in names)
            {
                var value = totals[name] / portions;
                result[name] = new BsonDouble(name == "calories"
                    ? Math.Floor(value + 0.5)
                    : Math.Floor(value * 10 + 0.5) / 10);
            }
            return result;
        }

        /// <summary>Recreates the unique indexes a drop or a restore removes.</summary>
        public static void RecreateIndexes(IMongoDatabase database)
        {
            var keys = Builders<BsonDocument>.IndexKeys;
            Index(database, "ingredient", keys.Ascending("name"), "name_1");
            Index(database, "ingredient_post", keys.Ascending("unique_id"), "unique_id_1");
            Index(database, "dish", keys.Ascending("name"), "name_1");
            Index(database, "dish_post", keys.Ascending("unique_id"), "unique_id_1");
            Index(database, "vote", keys.Ascending("user_id").Ascending("dish_post_id"),
                "user_id_1_dish_post_id_1");
        }

        /// <summary>Reads MONGODB_URI, or the URI given on the command line, then the local server.</summary>
        public static string ConnectionString(string? uri = null)
        {
            if (!string.IsNullOrWhiteSpace(uri))
            {
                return uri!;
            }
            var value = Environment.GetEnvironmentVariable("MONGODB_URI");
            return string.IsNullOrWhiteSpace(value) ? "mongodb://localhost:27017" : value!;
        }

        private static void Insert(IMongoDatabase database, string name, List<BsonDocument> documents)
        {
            if (documents.Count > 0)
            {
                database.GetCollection<BsonDocument>(name).InsertMany(documents);
            }
        }

        private static void Index(IMongoDatabase database, string collection, IndexKeysDefinition<BsonDocument> keys, string name)
        {
            database.GetCollection<BsonDocument>(collection).Indexes.CreateOne(
                new CreateIndexModel<BsonDocument>(keys, new CreateIndexOptions { Unique = true, Name = name }));
        }

        private static BsonValue Servings(BsonDocument dish)
        {
            if (!dish.TryGetValue("servings", out var value) || value.IsBsonNull || value.ToDouble() == 0)
            {
                return BsonNull.Value;
            }
            return value;
        }

        private static BsonArray DisplayBlocks(BsonDocument dish)
        {
            var blocks = new BsonArray();
            foreach (var step in Field(dish, "steps", new BsonArray()).AsBsonArray)
            {
                var document = step.AsBsonDocument;
                blocks.Add(new BsonDocument
                {
                    { "type", "text" },
                    { "text", Field(document, "text", "") },
                    { "text_vi", Field(document, "text_vi", "") },
                    { "font_size", new BsonDouble(14) },
                    { "color", "black" }
                });
            }
            return blocks;
        }

        private static BsonValue Field(BsonDocument document, string name, BsonValue? fallback = null)
        {
            return document.TryGetValue(name, out var value) && !value.IsBsonNull
                ? value
                : fallback ?? BsonNull.Value;
        }
    }
}
