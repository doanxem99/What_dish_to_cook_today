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
                    InitData.Init();
                }
                else if(action == "--update_ingredient_vote_best_post")
                {
                    string ingredientId = args[1];
                    IngredientVoteBestPost.AddRequest(ingredientId);
                }
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }

            Console.ReadKey();


            /*Console.WriteLine("Begin----------->");
            InitData.Init();
            Console.WriteLine("Done----------->");

            Console.ReadKey();*/
        }
    }
}
