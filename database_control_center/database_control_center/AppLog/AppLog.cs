using System;
using System.IO;

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
        private static string logPath = "";

        public static void Log(AppLogType _applockType, string _data)
        {
            string displayData = _applockType + " : " + _data;
            //UI actions and background work both log, so the file needs one lock.
            lock (logLock)
            {
                //First, we check if not aready init, we init
                if (!isInit)
                {
                    isInit = true;
                    try
                    {
                        logPath = OpenLogPath();
                    }
                    catch (Exception)
                    {
                        logPath = "";
                    }
                }

                //First, we show output log
                System.Diagnostics.Debug.WriteLine(displayData);
                //Then, we write data to file; a logging failure must not break the action.
                if (logPath.Length > 0)
                {
                    try
                    {
                        File.AppendAllText(logPath, displayData + Environment.NewLine);
                    }
                    catch (IOException)
                    {
                    }
                    catch (UnauthorizedAccessException)
                    {
                    }
                }
            }
            //Then, we trigger event
            eventLog?.Invoke(displayData);
        }

        //Next to the executable when that folder is writable, else under %LOCALAPPDATA%.
        private static string OpenLogPath()
        {
            var besideExe = Path.Combine(AppContext.BaseDirectory, "Temporary");
            try
            {
                Directory.CreateDirectory(besideExe);
                var path = Path.Combine(besideExe, "AppLog.txt");
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
                return path;
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }

            var local = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "database_control_center",
                "Temporary");
            Directory.CreateDirectory(local);
            var fallback = Path.Combine(local, "AppLog.txt");
            if (File.Exists(fallback))
            {
                File.Delete(fallback);
            }
            return fallback;
        }
    }
}
