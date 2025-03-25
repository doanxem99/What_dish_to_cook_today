using System;
using System.Collections.Generic;
using System.Text;
using MongoDB.Bson;
using MongoDB.Driver;

namespace db_control.VoteBestPost
{
    public class IngredientVoteBestPost
    {
        static List<VoteBestPostRequest> requests = new List<VoteBestPostRequest>();

        public static void Update()
        {
            MongoClient dbClient = new MongoClient("mongodb://localhost:27017");
            //Get DB(Create new if not aready exist)
            IMongoDatabase mongoDatabase = dbClient.GetDatabase("what_dish_to_cook_today");
            string collectionName = "ingredient";
            IMongoCollection<BsonDocument> ingredientCollection = mongoDatabase.GetCollection<BsonDocument>(collectionName);

            Dictionary<String, DateTime> ingredientTimeHandleDictionary = new Dictionary<string, DateTime>();
            //*Check requests to handle
            while (requests.Count > 0)
            {
                //Get the first request for handle
                //Only handle this request if ingredientTimeHandle not containt this ingredient
                //or last timeHandle of this ingredient < requests time
                VoteBestPostRequest voteBestPostRequest = requests[0];
                if (!ingredientTimeHandleDictionary.ContainsKey(voteBestPostRequest.id) ||
                    ingredientTimeHandleDictionary[voteBestPostRequest.id] < voteBestPostRequest.timeRequest)
                {
                    //Save time handle for this ingredient is now
                    ingredientTimeHandleDictionary[voteBestPostRequest.id] = DateTime.Now;

                    //Handle request
                    var item = ingredientCollection.Find(Builders<BsonDocument>.Filter.Eq("_id", voteBestPostRequest.id)).FirstOrDefaultAsync();

                    //For now, we just set the first post is best post
                    BsonDocument posts = item.Result.GetValue("posts").ToBsonDocument();
                    IEnumerable<string> keyPosts = posts.Names;
                    foreach(string key in keyPosts)
                    {
                        item.Result.Set("best_post_id", "user_id_create_this_post");
                    }
                }
            }
        }

        public static void AddRequest(string _ingredientId)
        {
            requests.Add(new VoteBestPostRequest() { id = _ingredientId, timeRequest = DateTime.Now });
        }
    }
}
