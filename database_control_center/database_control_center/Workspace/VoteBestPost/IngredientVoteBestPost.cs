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
                        dbClient = new MongoClient(database_seed.DatabaseSeed.ConnectionString());
                    }
                    if (mongoDatabase == null)
                    {
                        mongoDatabase = dbClient.GetDatabase(database_seed.DatabaseSeed.DatabaseName);
                    }
                    IMongoCollection<BsonDocument> ingredientCollection = mongoDatabase.GetCollection<BsonDocument>(collectionName);
                    IMongoCollection<BsonDocument> ingredientPostCollection = mongoDatabase.GetCollection<BsonDocument>("ingredient_post");

                    //Save time handle for this ingredient is now
                    ingredientTimeHandleDictionary[_ingredientId] = DateTime.Now;

                    if (!ObjectId.TryParse(_ingredientId, out ObjectId ingredientObjectId))
                    {
                        AppLog.Log(AppLogType.Waring, "Ingredient id is not valid : " + _ingredientId);
                        return true;
                    }

                    //Pick the post with the most points as the best post
                    BsonDocument? bestPost = ingredientPostCollection
                        .Find(Builders<BsonDocument>.Filter.Eq("ingredient_id", _ingredientId))
                        .Sort(Builders<BsonDocument>.Sort.Descending("points"))
                        .FirstOrDefault();
                    if (bestPost == null)
                    {
                        AppLog.Log(AppLogType.Comment, "Ingredient has no post to vote : " + _ingredientId);
                        return true;
                    }

                    //Only one post can be the best post
                    ingredientPostCollection.UpdateMany(
                        Builders<BsonDocument>.Filter.Eq("ingredient_id", _ingredientId),
                        Builders<BsonDocument>.Update.Set("is_best_post", false));
                    ingredientPostCollection.UpdateOne(
                        Builders<BsonDocument>.Filter.Eq("_id", bestPost.GetValue("_id")),
                        Builders<BsonDocument>.Update.Set("is_best_post", true));
                    ingredientCollection.UpdateOne(
                        Builders<BsonDocument>.Filter.Eq("_id", ingredientObjectId),
                        Builders<BsonDocument>.Update.Set("best_post_id", bestPost.GetValue("_id").ToString()));

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
