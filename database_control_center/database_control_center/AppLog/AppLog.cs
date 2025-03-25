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
        private static string directoryPath = Directory.GetCurrentDirectory() + "/Temporary";
        private static string logPath = directoryPath + "/AppLog.txt";

        public static void Log(AppLogType _applockType, string _data)
        {
            string displayData = _applockType + " : " + _data;
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
            File.AppendAllText(logPath, displayData);
            //Then, we trigger event
            eventLog?.Invoke(displayData);
        }
    }
}
