using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_control_center
{
    public class IngredientVoteBestPost
    {
        private static Dictionary<String, DateTime> ingredientTimeHandleDictionary = new Dictionary<string, DateTime>();
        private static MongoClient? dbClient;
        private static IMongoDatabase? mongoDatabase;
        private static string collectionName = "ingredient";

        public static bool VoteBestPost(string _ingredientId, DateTime _timeRequest)
        {
            try
            {
                if (!ingredientTimeHandleDictionary.ContainsKey(_ingredientId) ||
                    ingredientTimeHandleDictionary[_ingredientId] < _timeRequest)
                {
                    if(dbClient == null)
                    {
                        dbClient = new MongoClient("mongodb://localhost:27017");
                    }
                    if (mongoDatabase == null)
                    {
                        mongoDatabase = dbClient.GetDatabase("what_dish_to_cook_today");
                    }
                    IMongoCollection<BsonDocument> ingredientCollection = mongoDatabase.GetCollection<BsonDocument>(collectionName);

                    //Save time handle for this ingredient is now
                    ingredientTimeHandleDictionary[_ingredientId] = DateTime.Now;

                    //Handle request
                    var item = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("_id", _ingredientId)).FirstOrDefaultAsync();

                    //For now, we just set the first post is best post
                    BsonDocument posts = item.Result.GetValue("posts").ToBsonDocument();
                    IEnumerable<string> keyPosts = posts.Names;
                    foreach (string key in keyPosts)
                    {
                        item.Result.Set("best_post_id", "user_id_create_this_post");
                    }

                    AppLog.Log(AppLogType.Comment, "Success vote best post ingredient : " + _ingredientId);
                }
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

            return true;
        }
    }
}
