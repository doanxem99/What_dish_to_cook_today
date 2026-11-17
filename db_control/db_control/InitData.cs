using System;
using System.Collections.Generic;
using System.Text;
using MongoDB.Bson;
using MongoDB.Driver;

namespace db_control
{
    public class InitData
    {
        private static string adminId = "";

        public static void Init()
        {
            MongoClient dbClient = new MongoClient("mongodb://localhost:27017");
            //Get DB(Create new if not aready exist)
            IMongoDatabase mongoDatabase = dbClient.GetDatabase("what_dish_to_cook_today");

            //Resolve the admin user before any collection is dropped
            adminId = FindAdminId(mongoDatabase);

            //*Create new data
            // CreateDefaultRoles(mongoDatabase);
            CreateDefaultIngredientsPosts(mongoDatabase);
            CreateDefaultIngredients(mongoDatabase);
            UpdateIdIngredientPost(mongoDatabase);
            CreateDefaultDishs(mongoDatabase);
        }

        private static string FindAdminId(IMongoDatabase _mongoDatabase)
        {
            var filter = Builders<BsonDocument>.Filter.Eq("username", "moonshine@gmail.com");
            var admin = _mongoDatabase.GetCollection<BsonDocument>("user").Find(filter).FirstOrDefault();
            if (admin == null)
            {
                throw new InvalidOperationException("User moonshine@gmail.com must exist before data init.");
            }
            return admin.GetValue("_id").ToString();
        }
        // private static void CreateDefaultRoles(IMongoDatabase _mongoDatabase) {
        //     // Create role collection
        //     var collectionName = "role";
        //     _mongoDatabase.DropCollection(collectionName);
        //     _mongoDatabase.CreateCollection(collectionName);
        //     IMongoCollection<BsonDocument> roleCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);
        //     // Create default role data
        //     var roles = new List<BsonDocument> {
        //         new() {
        //             {"name", "user"},
        //             {"description", "User role"},
        //         },
        //         new() {
        //             {"name", "admin"},
        //             {"description", "Admin role"},
        //         },
        //     };
        //     // Insert default role data into role collection
        //     roleCollection.InsertMany(roles);
        // }

        private static void CreateDefaultIngredientsPosts(IMongoDatabase _mongoDatabase) {
            string collectionName = "ingredient_post";
            //First, we get ingredient_post collection
            _mongoDatabase.DropCollection(collectionName);
            _mongoDatabase.CreateCollection(collectionName);
            IMongoCollection<BsonDocument> ingredientPostCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);

            //Then, we create default data
            ingredientPostCollection.InsertMany([
                CreateDefaultIngredientPostItem("Beef", adminId, "Food"),
                CreateDefaultIngredientPostItem("Salmon", adminId, "Food"),
                CreateDefaultIngredientPostItem("Egg", adminId, "Food"),
                CreateDefaultIngredientPostItem("Salt", adminId, "Spice"),
                CreateDefaultIngredientPostItem("Honey", adminId, "Spice"),
                CreateDefaultIngredientPostItem("Orangle", adminId, "Fruit"),
                CreateDefaultIngredientPostItem("Pork", adminId, "Food"),
                CreateDefaultIngredientPostItem("Chicken", adminId, "Food"),
                CreateDefaultIngredientPostItem("Potato", adminId, "Food"),
            ]);
        }

        private static void CreateDefaultIngredients(IMongoDatabase _mongoDatabase)
        {
            string collectionName = "ingredient";
            //First, we get collection collection
            _mongoDatabase.DropCollection(collectionName);
            _mongoDatabase.CreateCollection(collectionName);
            IMongoCollection<BsonDocument> ingredientCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);

            //Then, we create default data
            
            ingredientCollection.InsertMany([
                CreateDefaultIngredientItem("Beef", "Thịt bò", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Salmon", "Cá hồi", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Egg", "Trứng", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Salt", "Muối", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Honey", "Mật ong", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Orangle", "Cam", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Pork", "Thịt heo", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Chicken", "Thịt gà", adminId, _mongoDatabase),
                CreateDefaultIngredientItem("Potato", "Khoai tây", adminId, _mongoDatabase),
            ]);
        }
        private static void UpdateIdIngredientPost(IMongoDatabase _mongoDatabase)
        {
            UpdateIdIngredientPostItem("Beef", _mongoDatabase);
            UpdateIdIngredientPostItem("Salmon", _mongoDatabase);
            UpdateIdIngredientPostItem("Egg", _mongoDatabase);
            UpdateIdIngredientPostItem("Salt", _mongoDatabase);
            UpdateIdIngredientPostItem("Honey", _mongoDatabase);
            UpdateIdIngredientPostItem("Orangle", _mongoDatabase);
            UpdateIdIngredientPostItem("Pork", _mongoDatabase);
            UpdateIdIngredientPostItem("Chicken", _mongoDatabase);
            UpdateIdIngredientPostItem("Potato", _mongoDatabase);
        }

        private static void CreateDefaultDishs(IMongoDatabase _mongoDatabase)
        {
            string collectionName = "dish";
            //First, we get dish collection
            _mongoDatabase.DropCollection(collectionName);
            _mongoDatabase.CreateCollection(collectionName);
            IMongoCollection<BsonDocument> dishCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);

            // Get adminId
            collectionName = "user";

            //Then we get some id
            collectionName = "ingredient";
            IMongoCollection<BsonDocument> ingredientCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);

            string idBeef = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Beef")).FirstOrDefault().GetValue("_id").ToString();
            string idSalt = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Salt")).FirstOrDefault().GetValue("_id").ToString();

            BsonDocument post = new()
            {
                { "name", "Spagetti" },
                { "name_vi", "Mì Ý" },
                { "user_id", adminId },
                { "dish_id", "" },
                { "is_best_post", true },
                { "date_time", DateTime.Now.ToLocalTime() },
                { "unique_id", adminId + "_" },
                { "points", 0 },
                { "views", 0},
                { "comments", 0},
                { "ingredients",
                    new BsonArray
                    {
                        idBeef , idSalt
                    }
                },
                { "short_detail", "Italian food" },
                { "short_detail_vi", "Món ăn Ý" },
                { "profile_image" , "public/pictures/dishs/Spaghetti.jpg" },
                { "display_blocks" ,
                    new BsonArray
                    {
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "There's nothing like classic spaghetti and meat sauce to bring people together around the dinner table. This homemade spaghetti sauce with ground beef recipe will satisfy all your comfort food cravings. " },
                            { "text_vi", "Không gì bằng mì Ý sốt thịt bò kiểu truyền thống cho bữa cơm gia đình. Công thức sốt cà chua với thịt bò băm này sẽ làm hài lòng mọi người." },
                            { "font_size" , 14 },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "How to Make Spaghetti Sauce with Ground Beef" },
                            { "font_size" , 24 },
                            { "font_weight" , "bold" },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Restaurant-worthy spaghetti sauce with ground beef is just a few steps away. You'll find the full recipe below, but here's a brief overview of what you can expect: " },
                            { "font_size" , 14 },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Cook Beef and Veggies" },
                            { "font_size" , 18 },
                            { "font_weight" , "bold" },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Cook ground beef in a saucepan over medium-high heat with garlic, onion, and green pepper. Stir until the meat is brown and crumbly. The vegetables should be tender. " },
                            { "font_size" , 14 },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Add Tomato Products and Season" },
                            { "font_size" , 18 },
                            { "font_weight" , "bold" },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Stir diced tomatoes, tomato sauce, and tomato paste into the beef mixture. Add oregano, basil, salt, and pepper. Simmer until thick and aromatic, then serve over cooked spaghetti noodles. " },
                            { "font_size" , 14 },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Troubleshooting Spaghetti Sauce" },
                            { "font_size" , 24 },
                            { "font_weight" , "bold" },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "If your spaghetti sauce didn't turn out exactly how you wanted it to, don't worry! There's probably an easy fix. " },
                            { "font_size" , 14 },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                        new BsonDocument
                        {
                            { "type" , "image" },
                            { "src", "public/pictures/dishs/Spaghetti.jpg" },
                            { "size", "80%" },
                            { "text", "Finally !" },
                            { "font_size" , 14 },
                        },
                    }
                }
            };

            //Then, we create default data
            dishCollection.InsertMany([
                new BsonDocument
                {
                    { "name" , "Spagetti" },
                    { "name_vi" , "Mì Ý" },
                    //Every day, the system will check to find the best post base on points and author popular
                    { "best_post_id" , "" },
                }
            ]);


            // Create dish_post collection
            collectionName = "dish_post";
            _mongoDatabase.DropCollection(collectionName); 
            _mongoDatabase.DropCollection("vote");
            _mongoDatabase.CreateCollection(collectionName);

            // Find dish_id in dish collection
            var filter = Builders<BsonDocument>.Filter.Eq("name", "Spagetti");
            var dishId = _mongoDatabase.GetCollection<BsonDocument>("dish").Find(filter).FirstOrDefault().GetValue("_id").ToString();
            post["dish_id"] = dishId;
            post["unique_id"] += dishId;
            _mongoDatabase.GetCollection<BsonDocument>(collectionName).InsertOne(post);

            // Update best_post_id in dish collection
            var distPostId = _mongoDatabase.GetCollection<BsonDocument>("dish_post").Find(filter).FirstOrDefault().GetValue("_id").ToString();
            var update = Builders<BsonDocument>.Update.Set("best_post_id", distPostId);
            _mongoDatabase.GetCollection<BsonDocument>("dish").UpdateOne(filter, update);
        }

        private static BsonDocument CreateDefaultIngredientPostItem(string _name, string adminId, string type)
        {
            return new() {
                { "name", _name },
                { "user_id", adminId },
                { "ingredient_id", "" },
                { "is_best_post", true },
                { "date_time", DateTime.Now.ToLocalTime() },
                { "unique_id", adminId + "_" },
                { "points", 0 },
                { "views", 0},
                { "comments", 0},
                { "type" , type } ,
                { "short_detail", "Nutritional food" },
                { "profile_image" , "public/pictures/ingredients/" + _name + ".jpg" },
                { "display_blocks" ,
                    new BsonArray
                    {
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "Beef is the culinary name for meat from cattle (Bos taurus)." },
                            { "font_size" , 14 },
                            { "text_align" , "left" },
                            { "color" , "black" }
                        },
                    }
                }
            };
        }

        private static BsonDocument CreateDefaultIngredientItem(string _name, string _nameVi, string adminId, IMongoDatabase _mongoDatabase)
        {
            var ingredientPost = _mongoDatabase.GetCollection<BsonDocument>("ingredient_post").Find(Builders<BsonDocument>.Filter.Eq("name", _name)).FirstOrDefault();

            return new() {
                { "name", _name },
                { "name_vi", _nameVi },
                { "best_post_id", ingredientPost.GetValue("_id").ToString() },
                // { "date_time", DateTime.Now.ToLocalTime() },
                // { "points", 0 },
                // { "type" , "Food" } ,
                // { "short_detail", "Nutritional food" },
                // { "profile_image" , "public/pictures/ingredients/" + _name + ".jpg" },
            };
        }

        private static void UpdateIdIngredientPostItem(string _name, IMongoDatabase _mongoDatabase)
        {
            var filter = Builders<BsonDocument>.Filter.Eq("name", _name);
            var ingredientId = _mongoDatabase.GetCollection<BsonDocument>("ingredient").Find(filter).FirstOrDefault().GetValue("_id").ToString();
            // Get ingredientId and userId from ingredient collection
            var ingredientPost = _mongoDatabase.GetCollection<BsonDocument>("ingredient_post").Find(filter).FirstOrDefault();
            var userId = ingredientPost.GetValue("user_id").ToString();
            // Update the ingredient_id and unique_id field in the ingredient_post collection
            var update = Builders<BsonDocument>.Update
                .Set("ingredient_id", ingredientId)
                .Set("unique_id", ingredientId + "_" + userId);
            _mongoDatabase.GetCollection<BsonDocument>("ingredient_post").UpdateOne(filter, update);
        }
    }
}
