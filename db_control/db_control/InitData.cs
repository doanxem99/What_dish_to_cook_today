using System;
using System.Collections.Generic;
using System.Text;
using MongoDB.Bson;
using MongoDB.Driver;

namespace db_control
{
    public class InitData
    {
        public static void Init()
        {
            MongoClient dbClient = new MongoClient("mongodb://localhost:27017");
            //Get DB(Create new if not aready exist)
            IMongoDatabase mongoDatabase = dbClient.GetDatabase("what_dish_to_cook_today");

            //*Create new data
            CreateDefaultIngredients(mongoDatabase);
            CreateDefaultDishs(mongoDatabase);
        }

        private static BsonDocument CreateDefaultIngredientItem(string _name)
        {
            BsonDocument defautPost = new BsonDocument{
                { "date_time", DateTime.Now.ToLocalTime() },
                { "points", 0 },
                { "type" , "Food" } ,
                { "short_detail", "Nutritional food" },
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

            return new BsonDocument
            {
                { "name" , _name },
                //Every day, the system will check to find the best post base on points and author popular
                { "best_post_id" , "user_id_create_this_post" },
                { "posts" ,
                    new BsonDocument
                    {
                        {
                            "user_id_create_this_post" , defautPost
                        }
                    }
                }
            };
        }

        private static void CreateDefaultIngredients(IMongoDatabase _mongoDatabase)
        {
            string collectionName = "ingredient";
            //First, we get collection collection
            _mongoDatabase.DropCollection(collectionName);
            _mongoDatabase.CreateCollection(collectionName);
            IMongoCollection<BsonDocument> ingredientCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);

            //Then, we create default data
            ingredientCollection.InsertMany(new List<BsonDocument>() {
                CreateDefaultIngredientItem("Beef"),
                CreateDefaultIngredientItem("Salmon"),
                CreateDefaultIngredientItem("Egg"),
                CreateDefaultIngredientItem("Salt"),
                CreateDefaultIngredientItem("Honey"),
                CreateDefaultIngredientItem("Orangle"),
            });
        }
        private static void CreateDefaultDishs(IMongoDatabase _mongoDatabase)
        {
            string collectionName = "dish";
            //First, we get collection collection
            _mongoDatabase.DropCollection(collectionName);
            _mongoDatabase.CreateCollection(collectionName);
            IMongoCollection<BsonDocument> dishCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);

            //The, we get some id
            collectionName = "ingredient";
            IMongoCollection<BsonDocument> ingredientCollection = _mongoDatabase.GetCollection<BsonDocument>(collectionName);
            string idBeef = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Beef")).FirstOrDefault().GetValue("_id").ToString();
            string idSalt = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("name", "Salt")).FirstOrDefault().GetValue("_id").ToString();

            BsonDocument post = new BsonDocument{
                { "date_time", DateTime.Now.ToLocalTime() },
                { "points", 0 },
                { "ingredients" ,
                    new BsonArray
                    {
                        idBeef , idSalt
                    }
                },
                { "short_detail", "Italian food" },
                { "profile_image" , "public/pictures/dishs/Spaghetti.jpg" },
                { "display_blocks" ,
                    new BsonArray
                    {
                        new BsonDocument
                        {
                            { "type" , "text" },
                            { "text", "There's nothing like classic spaghetti and meat sauce to bring people together around the dinner table. This homemade spaghetti sauce with ground beef recipe will satisfy all your comfort food cravings. " },
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
            dishCollection.InsertMany(new List<BsonDocument>() {
                new BsonDocument
                {
                    { "name" , "Spagetti" },
                    //Every day, the system will check to find the best post base on points and author popular
                    { "best_post_id" , "user_id_create_this_post" },
                    { "posts" ,
                        new BsonDocument
                        {
                            {
                                "user_id_create_this_post" , post
                            }
                        }
                    }
                }
            });
        }
    }
}
