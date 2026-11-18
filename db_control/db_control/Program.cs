using db_control.VoteBestPost;
using System;

namespace db_control
{
    class Program
    {
        static void Main(string[] args)
        {
            try
            {
                string action = args[0];

                if (action == "--init_data")
                {
                    database_seed.DatabaseSeed.Init(database_seed.DatabaseSeed.ConnectionString());
                }
                else if(action == "--update_ingredient_vote_best_post")
                {
                    string ingredientId = args[1];
                    IngredientVoteBestPost.AddRequest(ingredientId);
                    IngredientVoteBestPost.Update();
                }
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }

            //ReadKey throws when the tool runs without a console (scheduled task, CI)
            if (!Console.IsInputRedirected)
            {
                Console.ReadKey();
            }


            /*Console.WriteLine("Begin----------->");
            InitData.Init();
            Console.WriteLine("Done----------->");

            Console.ReadKey();*/
        }
    }
}
