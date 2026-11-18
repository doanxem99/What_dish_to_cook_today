using System;

namespace database_control_center
{
    /// <summary>
    /// The worker's ResetData job. It delegates to the same shared seed the
    /// command-line tool uses, so both tools write identical data.
    /// </summary>
    public class ResetData
    {
        public static bool Init()
        {
            try
            {
                database_seed.DatabaseSeed.Init(database_seed.DatabaseSeed.ConnectionString());
                AppLog.Log(AppLogType.Comment, "Reset data through the shared seed");
                return true;
            }
            catch (Exception ex)
            {
                //Missing admin or database: fail before any collection is dropped.
                AppLog.Log(AppLogType.Exception, "Reset failed: " + ex.Message);
                return false;
            }
        }
    }
}
