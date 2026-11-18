using System;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_seed
{
    /// <summary>
    /// Picks the post with the most points as an ingredient's best post. The connection is passed
    /// in, so the CLI and the Windows console can target any server.
    /// </summary>
    public static class IngredientVoteBestPost
    {
        /// <summary>Returns false when the ingredient or its posts are absent.</summary>
        public static bool Update(string ingredientId, string connectionString, string databaseName)
        {
            if (!ObjectId.TryParse(ingredientId, out var ingredientObjectId))
            {
                throw new ArgumentException("Ingredient id must be a 24-character hex id.", nameof(ingredientId));
            }

            var database = new MongoClient(connectionString).GetDatabase(databaseName);
            var ingredients = database.GetCollection<BsonDocument>("ingredient");
            var posts = database.GetCollection<BsonDocument>("ingredient_post");

            var ingredient = ingredients
                .Find(Builders<BsonDocument>.Filter.Eq("_id", ingredientObjectId))
                .FirstOrDefault();
            if (ingredient == null)
            {
                return false;
            }

            var bestPost = posts
                .Find(Builders<BsonDocument>.Filter.Eq("ingredient_id", ingredientId))
                .Sort(Builders<BsonDocument>.Sort.Descending("points"))
                .FirstOrDefault();
            if (bestPost == null)
            {
                return false;
            }

            //Only one post can be the best post.
            posts.UpdateMany(
                Builders<BsonDocument>.Filter.Eq("ingredient_id", ingredientId),
                Builders<BsonDocument>.Update.Set("is_best_post", false));
            posts.UpdateOne(
                Builders<BsonDocument>.Filter.Eq("_id", bestPost.GetValue("_id")),
                Builders<BsonDocument>.Update.Set("is_best_post", true));
            ingredients.UpdateOne(
                Builders<BsonDocument>.Filter.Eq("_id", ingredientObjectId),
                Builders<BsonDocument>.Update.Set("best_post_id", bestPost.GetValue("_id").ToString()));
            return true;
        }
    }
}
