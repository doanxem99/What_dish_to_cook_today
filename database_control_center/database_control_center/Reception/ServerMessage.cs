using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace database_control_center
{
    public enum ServerMessageCode
    {
        StatusRequest = 0
    }

    public class ServerMessage<T>
    {
        public ServerMessageCode messageCode;
        public T? messageData;
    }

}
