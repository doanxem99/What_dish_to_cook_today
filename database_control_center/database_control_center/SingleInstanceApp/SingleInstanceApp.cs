using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;

namespace database_control_center
{
    public static class SingleInstanceApp
    {
        public static void Init(string _appId, Action<List<string>> _eventInstanceAppSendArgs, Action _eventContinueMainApp)
        {
            Mutex mutex = new Mutex(true, _appId);

            if(mutex.WaitOne(TimeSpan.Zero, true))
            {
                ServerSingleInstanceApp.Init(_appId, _eventInstanceAppSendArgs);

                _eventContinueMainApp?.Invoke();

                mutex.ReleaseMutex();
            }
            else
            {
                ClientSingleInstanceApp.Init(_appId);
            }
        }
    }

    public static class ServerSingleInstanceApp
    {
        private static string appId;
        private static Action<List<string>> eventInstanceAppSendArgs;

        private static NamedPipeServerStream namedPipeServerStream = null;
        private static BackgroundWorker backgroundWorker = null;

        public static void Init(string _appId, Action<List<string>> _eventInstanceAppSendArgs)
        {
            appId = _appId;
            eventInstanceAppSendArgs = _eventInstanceAppSendArgs;

            CreateListeningArgsFromInstanceApps();
        }

        private static void CreateListeningArgsFromInstanceApps()
        {
            backgroundWorker = new BackgroundWorker();
            backgroundWorker.WorkerSupportsCancellation = true;
            backgroundWorker.DoWork += new DoWorkEventHandler(backgroundWorker_Reader);
            backgroundWorker.WorkerReportsProgress = true;
            backgroundWorker.RunWorkerAsync();

        }

        private static void backgroundWorker_Reader(object sender, DoWorkEventArgs e)
        {
            //Init
            if (namedPipeServerStream != null)
            {
                namedPipeServerStream.Close();
                namedPipeServerStream.Dispose();
            }
            namedPipeServerStream = new NamedPipeServerStream(appId, PipeDirection.In);
            namedPipeServerStream.WaitForConnection();

            try
            {
                while (namedPipeServerStream.IsConnected == false)
                {
                    Thread.Sleep(100);
                }

                // Read user input and send that to the client process.
                using (StreamReader sr = new StreamReader(namedPipeServerStream))
                {
                    while (namedPipeServerStream.IsConnected)
                    {
                        if (backgroundWorker.CancellationPending == true)
                        {
                            e.Cancel = true;
                            break;
                        }
                        else
                        {
                            string temp;
                            List<string> args = new List<string>();
                            while ((temp = sr.ReadLine()) != null)
                            {
                                args.Add(temp);
                                Console.WriteLine("Received from client: {0}", temp);
                            }
                            if (args.Count > 0)
                            {
                                eventInstanceAppSendArgs?.Invoke(args);

                                //Create another listening
                                CreateListeningArgsFromInstanceApps();
                                break;
                            }

                            Thread.Sleep(100);
                        }
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
                //Handle usual Communication Exceptions here - just logging here for demonstration and debugging Purposes
                //Invoke(updateLog, new object[] { ex.Message });
            }
        }
    }

    public static class ClientSingleInstanceApp
    {
        public static void Init(string _appId)
        {
            SendArgToMainInstanceApp(_appId);
        }

        private static void SendArgToMainInstanceApp(string _appId)
        {
            using (NamedPipeClientStream pipeClient = new NamedPipeClientStream(".", _appId, PipeDirection.Out))
            {

                // Connect to the pipe or wait until the pipe is available.
                Console.Write("Attempting to connect to pipe...");
                pipeClient.Connect();

                Console.WriteLine("Connected to pipe.");
                Console.WriteLine("There are currently {0} pipe server instances open.",
                   pipeClient.NumberOfServerInstances);
                using (StreamWriter sw = new StreamWriter(pipeClient))
                {
                    string[] args = Environment.GetCommandLineArgs();
                    foreach (string arg in args)
                    {
                        sw.WriteLine(arg);
                    }
                }

                pipeClient.Close();
                pipeClient.Dispose();
            }
        }
    }
}
