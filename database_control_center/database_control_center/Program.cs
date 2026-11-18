namespace database_control_center
{
    internal static class Program
    {
        /// <summary>The offline console needs only a reachable MongoDB; it never contacts the API.</summary>
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
