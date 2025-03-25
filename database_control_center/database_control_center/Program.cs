using System.Diagnostics;
using System.Runtime.InteropServices;

namespace database_control_center
{
    internal static class Program
    {
        static string appId = "{8F6F0AC4-B9A1-45fd-A8CF-72F04E6BDE8F}";

        /// <summary>
        ///  The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main()
        {
            SingleInstanceApp.Init(appId, 
                delegate (List<string> _args)
                {
                    ArgReception.HandleArg(_args);
                }, 
                delegate ()
                {
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    Application.Run(new MainForm());
                }
            );
        }
    }
}