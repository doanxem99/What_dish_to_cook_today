using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace database_control_center
{
    public static class Workspace
    {
        public static Action<WorkerStatus>? eventWorkerStatusChanged;

        private static bool isInit = false;
        private static WorkerStatus workerStatus = WorkerStatus.Idle;
        private static BackgroundWorker? backgroundWorker = null;

        public static void Init()
        {
            if (!isInit)
            {
                isInit = true;
                AppLog.Log(AppLogType.Comment, "Init workspace");

                //Create background worker
                backgroundWorker = new BackgroundWorker
                {
                    WorkerSupportsCancellation = true
                };
                backgroundWorker.DoWork += new DoWorkEventHandler(BackgroundWorker_Handle!);
                backgroundWorker.WorkerReportsProgress = true;
                backgroundWorker.RunWorkerAsync();
            }
        }

        private static void BackgroundWorker_Handle(object sender, DoWorkEventArgs e)
        {
            try
            {
                //Create connect to DB
                MongoClient dbClient = new("mongodb://localhost:27017");
                //Get DB(Create new if not aready exist)
                IMongoDatabase mongoDatabase = dbClient.GetDatabase("what_dish_to_cook_today");
                //Get database_worker_job collection
                IMongoCollection<BsonDocument> jobCollection = mongoDatabase.GetCollection<BsonDocument>("database_worker_job");

                //*Check requests to handle
                while (true)
                {
                    if (backgroundWorker?.CancellationPending == true)
                    {
                        e.Cancel = true;
                        break;
                    }
                    else
                    {
                        //Check DB to get jobs need to work
                        List<BsonDocument> jobs = jobCollection.Find(_ => true).ToList();
                        if (jobs.Count > 0)
                        {
                            SetWorkerStatus(WorkerStatus.Working);
                            AppLog.Log(AppLogType.Comment, "Start handling " + jobs.Count + " jobs");

                            bool isSuccess;
                            foreach(BsonDocument job in jobs)
                            {
                                string? id = job.GetValue("_id").ToString();
                                string? data = job.GetValue("data").ToString();
                                string? timeRequest = job.GetValue("time_request").ToString();
                                AppLog.Log(AppLogType.Comment, "Handle job : " + id + " - " + data + " - " + timeRequest);

                                string[] datas = data!.Split(':');
                                if (datas[0] == "ResetData")
                                {
                                    isSuccess = ResetData.Init();
                                }
                                else if (datas[0] == "VoteBestPostIngredient")
                                {
                                    isSuccess = IngredientVoteBestPost.VoteBestPost(datas[1], DateTime.Parse(timeRequest!));
                                }
                                else
                                {
                                    //If message is unknow, we...
                                    isSuccess = true;
                                }

                                //Remove out of DB
                                jobCollection.DeleteOne(job);
                            }

                            AppLog.Log(AppLogType.Comment, "Finished handling jobs");
                        }
                        else
                        {
                            SetWorkerStatus(WorkerStatus.Idle);
                        }

                        //Sleep thread 100 milisecond before continue check
                        Thread.Sleep(TimeSpan.FromMilliseconds(100));
                    }
                }
            }
            catch (Exception ex)
            {
                AppLog.Log(AppLogType.Exception, ex.ToString());
                if (ex.StackTrace != null)
                {
                    AppLog.Log(AppLogType.Exception, "StackTrace : " + ex.StackTrace!);
                }
            }
        }


        private static void SetWorkerStatus(WorkerStatus _workerStatus)
        {
            if (workerStatus != _workerStatus)
            {
                workerStatus = _workerStatus;

                //Trigger events
                eventWorkerStatusChanged?.Invoke(workerStatus);
            }
        }

        public static WorkerStatus GetWorkerStatus()
        {
            return workerStatus;
        }
    }
}
