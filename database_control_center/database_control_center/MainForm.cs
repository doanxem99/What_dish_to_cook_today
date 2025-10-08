using MongoDB.Bson;
using MongoDB.Driver;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Controls;
using System.Windows.Forms;

namespace database_control_center
{
    public partial class MainForm : Form
    {
        private readonly List<string> requestMessageWaitings = [];
        private readonly List<string> logMessageWaitings = [];

        public MainForm()
        {
            InitializeComponent();

            requestListBox.Items.Clear();
            logListBox.Items.Clear();

            Reception.eventRequest += HandleRequest;

            AppLog.eventLog += HandleLogShow;

            Reception.Init();
            Workspace.Init();
        }
        private void ShowLog(string _message)
        {
            if (!this.IsHandleCreated)
            {
                logMessageWaitings.Add(_message);
            }
            else
            {
                this.Invoke(new MethodInvoker(delegate ()
                {
                    logListBox.Items.Add(_message);

                    //Scroll to bottom
                    ScrollLogListBoxToBottom();
                }));
            }
        }
        private void ScrollLogListBoxToBottom()
        {
            int visibleItems = logListBox.ClientSize.Height / logListBox.ItemHeight;
            logListBox.TopIndex = Math.Max(logListBox.Items.Count - visibleItems + 1, 0);
        }
        private void ShowRequest(string _message)
        {
            if (!this.IsHandleCreated)
            {
                requestMessageWaitings.Add(_message);
            }
            else
            {
                this.Invoke(new MethodInvoker(delegate ()
                {
                    requestListBox.Items.Add(_message);

                    //Scroll to bottom
                    ScrollRequestListBoxToBottom();
                }));
            }
        }
        private void ScrollRequestListBoxToBottom()
        {
            int visibleItems = requestListBox.ClientSize.Height / requestListBox.ItemHeight;
            requestListBox.TopIndex = Math.Max(requestListBox.Items.Count - visibleItems + 1, 0);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);

            foreach(string message in requestMessageWaitings)
            {
                requestListBox.Items.Add(message);
            }
            requestMessageWaitings.Clear();

            foreach (string message in logMessageWaitings)
            {
                logListBox.Items.Add(message);
            }
            logMessageWaitings.Clear();


            //Scroll to bottom
            ScrollLogListBoxToBottom();
            ScrollRequestListBoxToBottom();
        }

        public void HandleRequest(string _request)
        {
            ShowRequest(_request);
        }
        public void HandleLogShow(string _log)
        {
            ShowLog(_log);
        }

        private void ApplyCommentInsert()
        {
            string requestText = commentInsertTextBox.Text;
            foreach(string request in requestText.Split(" "))
            {
                Reception.AddRequest(request);
            }

            //Remove text
            commentInsertTextBox.Text = "";
        }

        private void commentInsertButton_Click(object sender, EventArgs e)
        {
            ApplyCommentInsert();
        }

        private void commentInsertTextBox_KeyPress(object sender, KeyPressEventArgs e)
        {
            if (e.KeyChar == (char)Keys.Enter)
            {
                ApplyCommentInsert();
            }
        }
    }
}