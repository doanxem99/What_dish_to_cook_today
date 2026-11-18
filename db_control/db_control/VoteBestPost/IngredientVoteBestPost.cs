using System;
using System.Collections.Generic;
using System.Text;
using MongoDB.Bson;
using MongoDB.Driver;

namespace db_control.VoteBestPost
{
    public class IngredientVoteBestPost
    {
        static List<VoteBestPostRequest> requests = [];

        public static void Update()
        {
            MongoClient dbClient = new MongoClient(database_seed.DatabaseSeed.ConnectionString());
            //Get DB(Create new if not aready exist)
            IMongoDatabase mongoDatabase = dbClient.GetDatabase(database_seed.DatabaseSeed.DatabaseName);
            string collectionName = "ingredient";
            IMongoCollection<BsonDocument> ingredientCollection = mongoDatabase.GetCollection<BsonDocument>(collectionName);
            IMongoCollection<BsonDocument> ingredientPostCollection = mongoDatabase.GetCollection<BsonDocument>("ingredient_post");

            Dictionary<String, DateTime> ingredientTimeHandleDictionary = [];
            //*Check requests to handle
            while (requests.Count > 0)
            {
                //Get the first request for handle
                //Only handle this request if ingredientTimeHandle not containt this ingredient
                //or last timeHandle of this ingredient < requests time
                VoteBestPostRequest voteBestPostRequest = requests[0];
                //A handled request must leave the list, or this loop never ends
                requests.RemoveAt(0);

                if (!ingredientTimeHandleDictionary.TryGetValue(voteBestPostRequest.id, out DateTime value) 
                    || value < voteBestPostRequest.timeRequest)
                {
                    value = DateTime.Now;
                    //Save time handle for this ingredient is now
                    ingredientTimeHandleDictionary[voteBestPostRequest.id] = value;

                    if (!ObjectId.TryParse(voteBestPostRequest.id, out ObjectId ingredientObjectId))
                    {
                        Console.WriteLine("Ingredient id is not valid : " + voteBestPostRequest.id);
                        continue;
                    }

                    //Pick the post with the most points as the best post
                    BsonDocument? bestPost = ingredientPostCollection
                        .Find(Builders<BsonDocument>.Filter.Eq("ingredient_id", voteBestPostRequest.id))
                        .Sort(Builders<BsonDocument>.Sort.Descending("points"))
                        .FirstOrDefault();
                    if (bestPost == null)
                    {
                        Console.WriteLine("Ingredient has no post to vote : " + voteBestPostRequest.id);
                        continue;
                    }

                    //Only one post can be the best post
                    ingredientPostCollection.UpdateMany(
                        Builders<BsonDocument>.Filter.Eq("ingredient_id", voteBestPostRequest.id),
                        Builders<BsonDocument>.Update.Set("is_best_post", false));
                    ingredientPostCollection.UpdateOne(
                        Builders<BsonDocument>.Filter.Eq("_id", bestPost.GetValue("_id")),
                        Builders<BsonDocument>.Update.Set("is_best_post", true));
                    ingredientCollection.UpdateOne(
                        Builders<BsonDocument>.Filter.Eq("_id", ingredientObjectId),
                        Builders<BsonDocument>.Update.Set("best_post_id", bestPost.GetValue("_id").ToString()));
                }
            }
        }

        public static void AddRequest(string _ingredientId)
        {
            requests.Add(new VoteBestPostRequest() { id = _ingredientId, timeRequest = DateTime.Now });
        }
    }
}
