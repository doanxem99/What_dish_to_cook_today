using System;
using System.Collections.Generic;
using System.Text;
using System.Xml;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_control_center
{
    public class ResetData
    {
        public static bool Init()
        {
            AppLog.Log(AppLogType.Comment, "Start reset data");

            try
            {
                MongoClient dbClient = new MongoClient("mongodb://localhost:27017");
                //Get DB(Create new if not aready exist)
                IMongoDatabase mongoDatabase = dbClient.GetDatabase("what_dish_to_cook_today");

                //*Create new data
                CreateDefaultIngredients(mongoDatabase);
                CreateDefaultDishs(mongoDatabase);
            }
            catch (Exception ex)
            {
                AppLog.Log(AppLogType.Exception, ex.ToString());
                if (ex.StackTrace != null)
                {
                    AppLog.Log(AppLogType.Exception, "StackTrace : " + ex.StackTrace!);
                }

                return false;
            }
            AppLog.Log(AppLogType.Comment, "Finish reset data");

            return true;
        }
        private static BsonDocument CreateDefaultIngredientPost(bool _isBestPost,
            string _ingredientId, string _userId, string _uniqueId)
        {
            return new BsonDocument{
                { "ingredient_id", _ingredientId },
                { "user_id", _userId },
                { "unique_id", _uniqueId },
                { "is_best_post", _isBestPost },
                { "date_time", DateTime.Now.ToLocalTime() },
                { "points", 0 },
                { "type" , "Food" } ,
                { "short_detail", "Nutritional food" },
                { "short_detail_vi", "Thực phẩm bổ dưỡng" },
                { "profile_image" , "public/pictures/ingredients/salt.jpg" },
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

        private static BsonDocument CreateDefaultIngredient(string _name, string _nameVi)
        {
            return new BsonDocument
            {
                { "name" , _name },
                { "name_vi" , _nameVi },
                { "best_post_id" , "" },
                { "is_need_update" , false }
            };
        }

        private static BsonDocument CreateDefaultDishPost(bool _isBestPost, 
            string _dishId, string _userId, string _uniqueId,
            BsonArray _ingredientIds)
        {
            return new BsonDocument{
                { "name", "Spagetti" },
                { "name_vi", "Mì Ý" },
                { "dish_id", _dishId },
                { "user_id", _userId },
                { "unique_id", _uniqueId },
                { "is_best_post", _isBestPost },
                { "date_time", DateTime.Now.ToLocalTime() },
                { "points", 0 },
                { "views", 0 },
                { "comments", 0 },
                { "ingredients" , _ingredientIds },
                { "short_detail", "Nutritional food" },
                { "short_detail_vi", "Món ăn bổ dưỡng" },
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
        }

        private static BsonDocument CreateDefaultDish(string _name)
        {
            return new BsonDocument
            {
                { "name" , _name },
                { "best_post_id" , "" },
                { "is_need_update" , false }
            };
        }

        private static void CreateDefaultIngredients(IMongoDatabase _mongoDatabase)
        {
            string ingredientCollectionName = "ingredient";
            string ingredientPostCollectionName = "ingredient_post";
            //*First, we get collection collection
            _mongoDatabase.DropCollection(ingredientCollectionName);
            _mongoDatabase.DropCollection(ingredientPostCollectionName);
            _mongoDatabase.CreateCollection(ingredientCollectionName);
            _mongoDatabase.CreateCollection(ingredientPostCollectionName);
            IMongoCollection<BsonDocument> ingredientCollection = _mongoDatabase.GetCollection<BsonDocument>(ingredientCollectionName);
            IMongoCollection<BsonDocument> ingredientPostCollection = _mongoDatabase.GetCollection<BsonDocument>(ingredientPostCollectionName);

            //*Then, we create default data
            BsonDocument ingredientDocument, ingredientPostDocument;
            string ingredientId, ingredientPostId, unique_id;
            ingredientCollection.InsertOne(CreateDefaultIngredient("Beef", "Thịt bò"));
            ingredientDocument = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Beef")).FirstOrDefault();
            ingredientId = ingredientDocument.GetValue("_id").ToString();
            unique_id = ingredientId + "_unknow";
            ingredientPostCollection.InsertOne(CreateDefaultIngredientPost(true, ingredientId, "unknow", unique_id));
            ingredientPostDocument = ingredientPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            ingredientPostId = ingredientPostDocument.GetValue("_id").ToString();
            ingredientCollection.UpdateOne(ingredientDocument, Builders<BsonDocument>.Update.Set("best_post_id", ingredientPostId));

            ingredientCollection.InsertOne(CreateDefaultIngredient("Salmon", "Cá hồi"));
            ingredientDocument = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Salmon")).FirstOrDefault();
            ingredientId = ingredientDocument.GetValue("_id").ToString();
            unique_id = ingredientId + "_unknow";
            ingredientPostCollection.InsertOne(CreateDefaultIngredientPost(true, ingredientId, "unknow", unique_id));
            ingredientPostDocument = ingredientPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            ingredientPostId = ingredientPostDocument.GetValue("_id").ToString();
            ingredientCollection.UpdateOne(ingredientDocument, Builders<BsonDocument>.Update.Set("best_post_id", ingredientPostId));

            ingredientCollection.InsertOne(CreateDefaultIngredient("Egg", "Trứng"));
            ingredientDocument = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Egg")).FirstOrDefault();
            ingredientId = ingredientDocument.GetValue("_id").ToString();
            unique_id = ingredientId + "_unknow";
            ingredientPostCollection.InsertOne(CreateDefaultIngredientPost(true, ingredientId, "unknow", unique_id));
            ingredientPostDocument = ingredientPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            ingredientPostId = ingredientPostDocument.GetValue("_id").ToString();
            ingredientCollection.UpdateOne(ingredientDocument, Builders<BsonDocument>.Update.Set("best_post_id", ingredientPostId));

            ingredientCollection.InsertOne(CreateDefaultIngredient("Salt", "Muối"));;;
            ingredientDocument = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Salt")).FirstOrDefault();
            ingredientId = ingredientDocument.GetValue("_id").ToString();
            unique_id = ingredientId + "_unknow";
            ingredientPostCollection.InsertOne(CreateDefaultIngredientPost(true, ingredientId, "unknow", unique_id));
            ingredientPostDocument = ingredientPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            ingredientPostId = ingredientPostDocument.GetValue("_id").ToString();
            ingredientCollection.UpdateOne(ingredientDocument, Builders<BsonDocument>.Update.Set("best_post_id", ingredientPostId));

            ingredientCollection.InsertOne(CreateDefaultIngredient("Honey", "Mật ong"));
            ingredientDocument = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Honey")).FirstOrDefault();
            ingredientId = ingredientDocument.GetValue("_id").ToString();
            unique_id = ingredientId + "_unknow";
            ingredientPostCollection.InsertOne(CreateDefaultIngredientPost(true, ingredientId, "unknow", unique_id));
            ingredientPostDocument = ingredientPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            ingredientPostId = ingredientPostDocument.GetValue("_id").ToString();
            ingredientCollection.UpdateOne(ingredientDocument, Builders<BsonDocument>.Update.Set("best_post_id", ingredientPostId));

            ingredientCollection.InsertOne(CreateDefaultIngredient("Orange", "Cam"));
            ingredientDocument = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Orange")).FirstOrDefault();
            ingredientId = ingredientDocument.GetValue("_id").ToString();
            unique_id = ingredientId + "_unknow";
            ingredientPostCollection.InsertOne(CreateDefaultIngredientPost(true, ingredientId, "unknow", unique_id));
            ingredientPostDocument = ingredientPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            ingredientPostId = ingredientPostDocument.GetValue("_id").ToString();
            ingredientCollection.UpdateOne(ingredientDocument, Builders<BsonDocument>.Update.Set("best_post_id", ingredientPostId));
        }
        private static void CreateDefaultDishs(IMongoDatabase _mongoDatabase)
        {
            string ingredientCollectionName = "ingredient";
            string dishCollectionName = "dish";
            string dishPostCollectionName = "dish_post";
            //*First, we get collection collection
            _mongoDatabase.DropCollection(dishCollectionName);
            _mongoDatabase.DropCollection(dishPostCollectionName);
            _mongoDatabase.DropCollection("vote");
            _mongoDatabase.DropCollection("comment");
            _mongoDatabase.CreateCollection(dishCollectionName);
            _mongoDatabase.CreateCollection(dishPostCollectionName);
            IMongoCollection<BsonDocument> dishCollection = _mongoDatabase.GetCollection<BsonDocument>(dishCollectionName);
            IMongoCollection<BsonDocument> dishPostCollection = _mongoDatabase.GetCollection<BsonDocument>(dishPostCollectionName);

            //(*)Get ingredientIds need
            IMongoCollection<BsonDocument> ingredientCollection = _mongoDatabase.GetCollection<BsonDocument>(ingredientCollectionName);
            string idBeef = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Beef")).FirstOrDefault().GetValue("_id").ToString();
            string idSalt = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Salt")).FirstOrDefault().GetValue("_id").ToString();
            
            //*Then, we create default data
            BsonDocument dishDocument, dishPostDocument;
            string dishId, dishPostId, unique_id;
            dishCollection.InsertOne(CreateDefaultDish("Spagetti"));
            dishDocument = dishCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Spagetti")).FirstOrDefault();
            dishId = dishDocument.GetValue("_id").ToString();
            unique_id = dishId + "_unknow";
            dishPostCollection.InsertOne(CreateDefaultDishPost(true, dishId, "unknow", unique_id, [idBeef, idSalt]));
            dishPostDocument = dishPostCollection.Find(Builders<BsonDocument>.Filter.Eq("unique_id", unique_id)).FirstOrDefault();
            dishPostId = dishPostDocument.GetValue("_id").ToString();
            dishCollection.UpdateOne(dishDocument, Builders<BsonDocument>.Update.Set("best_post_id", dishPostId));
        }
    }
}
