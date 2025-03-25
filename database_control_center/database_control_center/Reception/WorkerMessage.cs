using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace database_control_center
{
    public enum WorkerStatus
    {
        Idle = 0,
        Working = 1
    }

    public enum WorkerMessageCode
    {
        Register = 0,
        StatusRespone = 1
    }

    public class WorkerMessage<T>
    {
        //workerType of this should alway is 0
        public int workerType = 0;
        public WorkerMessageCode messageCode;
        public T? messageData;
    }

}
