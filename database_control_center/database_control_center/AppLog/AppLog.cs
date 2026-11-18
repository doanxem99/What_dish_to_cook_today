using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace database_control_center
{
    public enum AppLogType
    {
        Comment,
        Waring,
        Exception
    }

    public static class AppLog
    {
        public static Action<string>? eventLog;

        private static bool isInit = false;
        private static readonly object logLock = new object();
        //Next to the executable, so the log does not depend on the working directory.
        private static readonly string directoryPath = Path.Combine(AppContext.BaseDirectory, "Temporary");
        private static readonly string logPath = Path.Combine(directoryPath, "AppLog.txt");

        public static void Log(AppLogType _applockType, string _data)
        {
            string displayData = _applockType + " : " + _data;
            //The websocket timer and the workspace thread both log, so the file needs one lock
            lock (logLock)
            {
                //First, we check if not aready init, we init
                if (!isInit)
                {
                    isInit = true;

                    Directory.CreateDirectory(directoryPath);
                    if (File.Exists(logPath))
                    {
                        File.Delete(logPath);
                    }
                }

                //First, we show output log
                System.Diagnostics.Debug.WriteLine(displayData);
                //Then, we write data to file
                File.AppendAllText(logPath, displayData + Environment.NewLine);
            }
            //Then, we trigger event
            eventLog?.Invoke(displayData);
        }
    }
}
