using System;
using System.Collections.Generic;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_seed
{
    /// <summary>
    /// Shared minimal reset used by both database tools. It requires the admin user,
    /// checks it before dropping anything, and seeds the small demo catalog.
    /// </summary>
    public static class DatabaseSeed
    {
        public const string DatabaseName = "what_dish_to_cook_today";
        public const string AdminUsername = "moonshine@gmail.com";

        private static readonly (string Name, string NameVi, string Type)[] Ingredients =
        {
            ("Beef", "Thịt bò", "Food"),
            ("Salmon", "Cá hồi", "Food"),
            ("Egg", "Trứng", "Food"),
            ("Salt", "Muối", "Spice"),
            ("Honey", "Mật ong", "Spice"),
            ("Orange", "Cam", "Fruit"),
            ("Pork", "Thịt heo", "Food"),
            ("Chicken", "Thịt gà", "Food"),
            ("Potato", "Khoai tây", "Food")
        };

        public static void Init(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("MongoDB connection string is empty.");
            }

            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(DatabaseName);

            // Resolve the admin before any collection is dropped.
            var admin = database.GetCollection<BsonDocument>("user")
                .Find(Builders<BsonDocument>.Filter.Eq("username", AdminUsername))
                .FirstOrDefault();
            if (admin == null)
            {
                throw new InvalidOperationException($"User {AdminUsername} must exist before data init.");
            }
            var adminId = admin.GetValue("_id").ToString();

            CreateIngredientPosts(database, adminId);
            CreateIngredients(database, adminId);
            CreateDish(database, adminId);
        }

        private static BsonDocument IngredientPost(string name, string nameVi, string type, string adminId)
        {
            return new BsonDocument
            {
                { "name", name },
                { "name_vi", nameVi },
                { "user_id", adminId },
                { "ingredient_id", "" },
                { "is_best_post", true },
                { "date_time", DateTime.Now.ToLocalTime() },
                { "unique_id", adminId + "_" },
                { "points", 0 },
                { "views", 0 },
                { "comments", 0 },
                { "type", type },
                { "short_detail", "Nutritional food" },
                { "short_detail_vi", "Thực phẩm bổ dưỡng" },
                { "profile_image", "public/pictures/ingredients/" + name + ".jpg" },
                { "display_blocks", new BsonArray
                    {
                        new BsonDocument
                        {
                            { "type", "text" },
                            { "text", $"{name} is kept in the shared catalog so every cook means the same thing." },
                            { "text_vi", $"{nameVi} được lưu trong danh mục chung để mọi người hiểu cùng một nghĩa." },
                            { "font_size", 14 },
                            { "text_align", "left" },
                            { "color", "black" }
                        }
                    }
                }
            };
        }

        private static void CreateIngredientPosts(IMongoDatabase database, string adminId)
        {
            database.DropCollection("ingredient_post");
            database.CreateCollection("ingredient_post");
            var posts = database.GetCollection<BsonDocument>("ingredient_post");
            var documents = new List<BsonDocument>();
            foreach (var ingredient in Ingredients)
            {
                documents.Add(IngredientPost(ingredient.Name, ingredient.NameVi, ingredient.Type, adminId));
            }
            posts.InsertMany(documents);
        }

        private static void CreateIngredients(IMongoDatabase database, string adminId)
        {
            database.DropCollection("ingredient");
            database.CreateCollection("ingredient");
            var ingredients = database.GetCollection<BsonDocument>("ingredient");
            var posts = database.GetCollection<BsonDocument>("ingredient_post");

            var documents = new List<BsonDocument>();
            foreach (var ingredient in Ingredients)
            {
                var post = posts.Find(Builders<BsonDocument>.Filter.Eq("name", ingredient.Name)).FirstOrDefault();
                documents.Add(new BsonDocument
                {
                    { "name", ingredient.Name },
                    { "name_vi", ingredient.NameVi },
                    { "best_post_id", post.GetValue("_id").ToString() }
                });
            }
            ingredients.InsertMany(documents);
        }

        private static void CreateDish(IMongoDatabase database, string adminId)
        {
            database.DropCollection("dish");
            database.DropCollection("dish_post");
            database.DropCollection("vote");
            database.DropCollection("comment");
            database.CreateCollection("dish");
            database.CreateCollection("dish_post");

            var dishes = database.GetCollection<BsonDocument>("dish");
            var posts = database.GetCollection<BsonDocument>("dish_post");
            var ingredients = database.GetCollection<BsonDocument>("ingredient");

            var idBeef = ingredients.Find(Builders<BsonDocument>.Filter.Eq("name", "Beef")).FirstOrDefault().GetValue("_id").ToString();
            var idSalt = ingredients.Find(Builders<BsonDocument>.Filter.Eq("name", "Salt")).FirstOrDefault().GetValue("_id").ToString();

            dishes.InsertOne(new BsonDocument
            {
                { "name", "Spagetti" },
                { "name_vi", "Mì Ý" },
                { "best_post_id", "" }
            });
            var dish = dishes.Find(Builders<BsonDocument>.Filter.Eq("name", "Spagetti")).FirstOrDefault();
            var dishId = dish.GetValue("_id").ToString();

            var post = new BsonDocument
            {
                { "name", "Spagetti" },
                { "name_vi", "Mì Ý" },
                { "user_id", adminId },
                { "dish_id", dishId },
                { "is_best_post", true },
                { "date_time", DateTime.Now.ToLocalTime() },
                { "unique_id", adminId + "_" + dishId },
                { "points", 0 },
                { "views", 0 },
                { "comments", 0 },
                { "ingredients", new BsonArray { idBeef, idSalt } },
                { "short_detail", "Italian food" },
                { "short_detail_vi", "Món ăn Ý" },
                { "profile_image", "public/pictures/dishs/Spaghetti.jpg" },
                { "display_blocks", new BsonArray
                    {
                        new BsonDocument
                        {
                            { "type", "text" },
                            { "text", "There's nothing like classic spaghetti and meat sauce to bring people together around the dinner table. This homemade spaghetti sauce with ground beef recipe will satisfy all your comfort food cravings." },
                            { "text_vi", "Không gì bằng mì Ý sốt thịt bò kiểu truyền thống cho bữa cơm gia đình. Công thức sốt cà chua với thịt bò băm này sẽ làm hài lòng mọi người." },
                            { "font_size", 14 },
                            { "text_align", "left" },
                            { "color", "black" }
                        },
                        new BsonDocument
                        {
                            { "type", "text" },
                            { "text", "How to Make Spaghetti Sauce with Ground Beef" },
                            { "font_size", 24 },
                            { "font_weight", "bold" },
                            { "text_align", "left" },
                            { "color", "black" }
                        },
                        new BsonDocument
                        {
                            { "type", "text" },
                            { "text", "Cook ground beef in a saucepan over medium-high heat with garlic, onion, and green pepper. Stir until the meat is brown and crumbly." },
                            { "font_size", 14 },
                            { "text_align", "left" },
                            { "color", "black" }
                        },
                        new BsonDocument
                        {
                            { "type", "text" },
                            { "text", "Stir diced tomatoes, tomato sauce, and tomato paste into the beef mixture. Add oregano, basil, salt, and pepper. Simmer until thick and aromatic, then serve over cooked spaghetti noodles." },
                            { "font_size", 14 },
                            { "text_align", "left" },
                            { "color", "black" }
                        },
                        new BsonDocument
                        {
                            { "type", "image" },
                            { "src", "public/pictures/dishs/Spaghetti.jpg" },
                            { "text", "Finally !" },
                            { "font_size", 14 }
                        }
                    }
                }
            };

            posts.InsertOne(post);
            var postId = posts.Find(Builders<BsonDocument>.Filter.Eq("unique_id", adminId + "_" + dishId)).FirstOrDefault().GetValue("_id").ToString();
            dishes.UpdateOne(dish, Builders<BsonDocument>.Update.Set("best_post_id", postId));
        }

        /// <summary>Reads MONGODB_URI, falling back to the local server.</summary>
        public static string ConnectionString()
        {
            var value = Environment.GetEnvironmentVariable("MONGODB_URI");
            return string.IsNullOrWhiteSpace(value) ? "mongodb://localhost:27017" : value;
        }

        /// <summary>Reads WORKER_WS_URL, falling back to the local worker endpoint.</summary>
        public static string WorkerUrl()
        {
            var value = Environment.GetEnvironmentVariable("WORKER_WS_URL");
            return string.IsNullOrWhiteSpace(value) ? "ws://localhost:3000/worker" : value;
        }
    }
}
