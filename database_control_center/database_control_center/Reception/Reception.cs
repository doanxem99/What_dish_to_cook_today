
using System;
using System.Threading;
using Websocket.Client;
using Newtonsoft.Json;
using System.Windows.Interop;
using System.Windows.Input;
using System.Timers;
using System.ComponentModel;
using System.Diagnostics;
using MongoDB.Bson;
using MongoDB.Driver;

namespace database_control_center
{
    public static class Reception
    {
        public static Action<string>? eventRequest;

        private static bool isInit = false;

        public static void Init()
        {
            if (!isInit)
            {
                isInit = true;
                AppLog.Log(AppLogType.Comment, "Init reception");

                //Init command line args
                ArgReception.Init();

                //Init server
                ServerReception.Init();
            }
        }

        public static void AddRequest(string _request)
        {
            AppLog.Log(AppLogType.Comment, "Add request : " + _request);

            //Add new job into db
            IMongoCollection<BsonDocument> jobCollection = GetJobCollection();
            //Inset job to jobCollection
            jobCollection.InsertOne(new BsonDocument
            {
                { "data" , _request },
                { "time_request" , DateTime.Now }
            });

            eventRequest?.Invoke(_request);
        }

        //One client is enough for the whole process
        private static readonly MongoClient dbClient = new MongoClient(database_seed.DatabaseSeed.ConnectionString());

        private static IMongoCollection<BsonDocument> GetJobCollection()
        {
            IMongoDatabase mongoDatabase = dbClient.GetDatabase(database_seed.DatabaseSeed.DatabaseName);
            return mongoDatabase.GetCollection<BsonDocument>("database_worker_job");
        }
    }

    public static class ArgReception
    {
        public static void Init()
        {
            string[] args = Environment.GetCommandLineArgs();
            HandleArg(new List<string>(args));
        }

        public static void HandleArg(List<string> _args)
        {
            //Command list
            //InitData
            //VoteBestPostIngredient:(id ingredient)

            int numberItem = _args.Count;
            List<string> requests = [];
            string request;
            for (int i = 1; i < numberItem; i++)
            {
                request = _args[i];

                //Handel request
                Reception.AddRequest(request);

                //Save request to trigger event
                requests.Add(request);
            }
        }
    }

    public static class ServerReception
    {
        private static WebsocketClient? client;
        private static System.Timers.Timer? timeLoopSendStatus;

        public static void Init()
        {
            try
            {
                AppLog.Log(AppLogType.Comment, "Connect server");

                var url = new Uri(database_seed.DatabaseSeed.WorkerUrl());
                client = new WebsocketClient(url);
                client.ReconnectTimeout = TimeSpan.FromSeconds(30);

                client.ReconnectionHappened.Subscribe(info =>
                {
                    AppLog.Log(AppLogType.Comment, "Reconnection happened, type: " + info.Type);

                    if (info.Type != ReconnectionType.Error)
                    {
                        //Register worker
                        string messageRegister = JsonConvert.SerializeObject(new WorkerMessage<string>()
                        {
                            messageCode = WorkerMessageCode.Register,
                        });
                        Task.Run(() =>
                        {
                            client.Send(messageRegister);
                        });

                        //Start timer loop send status
                        StartTimerLoopSendStatus();
                    }
                });
                client.MessageReceived.Subscribe(msg =>
                {
                    AppLog.Log(AppLogType.Comment, "MessageReceived : " + msg.Text);

                    //Handle request
                    ServerMessage<dynamic>? serverMessage = JsonConvert.DeserializeObject<ServerMessage<dynamic>>(msg.Text);
                    if (serverMessage != null)
                    {
                        if (serverMessage.messageCode == ServerMessageCode.StatusRequest)
                        {
                            UpdateWorkerStatus();
                        }
                    }

                    //client.Send(data);
                });
                client.DisconnectionHappened.Subscribe(info =>
                {
                    AppLog.Log(AppLogType.Comment, "DisconnectionHappened : " + info.Type);

                    //Stop timer loop send status
                    StopTimerLoopSendStatus();
                });
                client.Start();


                //*Add event
                Workspace.eventWorkerStatusChanged += delegate (WorkerStatus _workerStatus)
                {
                    UpdateWorkerStatus();
                };
            }
            catch (Exception ex)
            {
                AppLog.Log(AppLogType.Exception, ex.ToString());
                if(ex.StackTrace != null)
                {
                    AppLog.Log(AppLogType.Exception, "StackTrace : " + ex.StackTrace!);
                }
            }

        }

        private static void StartTimerLoopSendStatus()
        {
            //Creat loop, sending status to server every minutes
            timeLoopSendStatus = new System.Timers.Timer(60 * 1000);
            // Hook up the Elapsed event for the timer. 
            timeLoopSendStatus.Elapsed += delegate (object? source, ElapsedEventArgs e)
            {
                UpdateWorkerStatus();
            };
            timeLoopSendStatus.AutoReset = true;
            timeLoopSendStatus.Enabled = true;
        }

        private static void StopTimerLoopSendStatus()
        {
            if(timeLoopSendStatus != null)
            {
                timeLoopSendStatus.Stop();
                timeLoopSendStatus.Dispose();
            }
        }

        public static void UpdateWorkerStatus()
        {
            if(client != null)
            {
                string messageResponse = JsonConvert.SerializeObject(new WorkerMessage<WorkerStatus>()
                {
                    messageCode = WorkerMessageCode.StatusRespone,
                    messageData = Workspace.GetWorkerStatus()
                });

                AppLog.Log(AppLogType.Comment, "Update worker status to server: " + messageResponse);

                Task.Run(() =>
                {
                    client.Send(messageResponse);
                });
            }
        }
    }
}
