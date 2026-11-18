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

        //A job that always fails must not block the queue forever
        private const int MaxJobAttempts = 5;

        private static bool isInit = false;
        private static WorkerStatus workerStatus = WorkerStatus.Idle;
        private static BackgroundWorker? backgroundWorker = null;
        private static readonly Dictionary<string, int> failedJobAttempts = new();

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
                MongoClient dbClient = new(database_seed.DatabaseSeed.ConnectionString());
                //Get DB(Create new if not aready exist)
                IMongoDatabase mongoDatabase = dbClient.GetDatabase(database_seed.DatabaseSeed.DatabaseName);
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
                            bool hasFailedJob = false;
                            foreach(BsonDocument job in jobs)
                            {
                                string id = job.GetValue("_id").ToString();
                                string? data = job.TryGetValue("data", out BsonValue dataValue) ? dataValue.ToString() : null;
                                string? timeRequest = job.TryGetValue("time_request", out BsonValue timeValue) ? timeValue.ToString() : null;
                                AppLog.Log(AppLogType.Comment, "Handle job : " + id + " - " + data + " - " + timeRequest);

                                try
                                {
                                    if (data == null)
                                    {
                                        AppLog.Log(AppLogType.Waring, "Job has no data : " + id);
                                        isSuccess = false;
                                    }
                                    else
                                    {
                                        string[] datas = data.Split(':');
                                        if (datas[0] == "ResetData")
                                        {
                                            isSuccess = ResetData.Init();
                                        }
                                        else if (datas[0] == "VoteBestPostIngredient")
                                        {
                                            if (datas.Length < 2)
                                            {
                                                AppLog.Log(AppLogType.Waring, "Job has no ingredient id : " + id);
                                                isSuccess = false;
                                            }
                                            else
                                            {
                                                isSuccess = IngredientVoteBestPost.VoteBestPost(datas[1], DateTime.Parse(timeRequest!));
                                            }
                                        }
                                        else
                                        {
                                            //If message is unknow, we...
                                            isSuccess = true;
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    //One bad job must not stop the job thread
                                    AppLog.Log(AppLogType.Exception, "Job failed with exception : " + id + " - " + ex.Message);
                                    isSuccess = false;
                                }

                                if (!isSuccess)
                                {
                                    hasFailedJob = true;
                                    int attempts = failedJobAttempts.TryGetValue(id, out int current) ? current + 1 : 1;
                                    failedJobAttempts[id] = attempts;

                                    if (attempts >= MaxJobAttempts)
                                    {
                                        //Drop a job that keeps failing so it cannot block the queue
                                        AppLog.Log(AppLogType.Waring, "Job dropped after " + attempts + " failed attempts : " + id + " - " + data);
                                        failedJobAttempts.Remove(id);
                                        jobCollection.DeleteOne(job);
                                    }
                                    else
                                    {
                                        //Keep the job so a temporary failure can be retried
                                        AppLog.Log(AppLogType.Waring, "Job failed, kept for retry (" + attempts + "/" + MaxJobAttempts + ") : " + id);
                                    }

                                    continue;
                                }

                                failedJobAttempts.Remove(id);
                                //Remove out of DB
                                jobCollection.DeleteOne(job);
                            }

                            AppLog.Log(AppLogType.Comment, "Finished handling jobs");

                            if (hasFailedJob)
                            {
                                //Do not retry failing jobs in a tight loop
                                Thread.Sleep(TimeSpan.FromSeconds(5));
                            }
                        }
                        else
                        {
                            SetWorkerStatus(WorkerStatus.Idle);
                        }

                        //Sleep thread 1 second before continue check
                        Thread.Sleep(TimeSpan.FromSeconds(1));
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
