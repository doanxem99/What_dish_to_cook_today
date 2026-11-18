using System.Diagnostics;
using MongoDB.Bson;
using MongoDB.Driver;
using database_seed;

namespace database_control_center
{
    /// <summary>
    /// Offline console. It talks to MongoDB only: no WebSocket, no job polling, no server process.
    /// Every destructive action writes a backup first and refuses to continue when that fails.
    /// </summary>
    public partial class MainForm : Form
    {
        private readonly TextBox uriTextBox = new() { Dock = DockStyle.Fill };
        private readonly TextBox databaseTextBox = new() { Dock = DockStyle.Fill };
        private readonly Label connectionStatus = new() { AutoSize = true, ForeColor = SystemColors.GrayText };
        private readonly Label pingLabel = new() { AutoSize = true, Padding = new Padding(12, 6, 0, 0) };
        private readonly ListView healthView = new()
        {
            Dock = DockStyle.Fill,
            View = View.Details,
            FullRowSelect = true,
            GridLines = false,
            HeaderStyle = ColumnHeaderStyle.Nonclickable
        };
        private readonly TextBox ingredientIdTextBox = new() { Dock = DockStyle.Fill };
        private readonly ListBox logListBox = new() { Dock = DockStyle.Fill, HorizontalScrollbar = true };
        private readonly ToolStripStatusLabel statusLabel = new() { Text = "Ready", Spring = true, TextAlign = ContentAlignment.MiddleLeft };
        private readonly ToolStripStatusLabel databaseLabel = new() { Text = "" };

        public MainForm()
        {
            Text = "Database control center - offline";
            MinimumSize = new Size(780, 560);
            ClientSize = new Size(920, 640);
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Font;
            Padding = new Padding(10);

            BuildUi();

            uriTextBox.Text = database_seed.DatabaseSeed.ConnectionString();
            databaseTextBox.Text = database_seed.DatabaseSeed.DatabaseName;

            AppLog.eventLog += HandleLog;
            AppLog.Log(AppLogType.Comment, "Offline console started; no API server is contacted.");
            databaseLabel.Text = "API not required";
        }

        private void BuildUi()
        {
            var tabs = new TabControl { Dock = DockStyle.Fill, Padding = new Point(14, 6) };

            var connectionPage = new TabPage("Connection") { Padding = new Padding(12) };
            connectionPage.Controls.Add(BuildConnectionPage());

            var healthPage = new TabPage("Health") { Padding = new Padding(12) };
            healthPage.Controls.Add(BuildHealthPage());

            var operationsPage = new TabPage("Operations") { Padding = new Padding(12) };
            operationsPage.Controls.Add(BuildOperationsPage());

            var logPage = new TabPage("Log") { Padding = new Padding(12) };
            logPage.Controls.Add(logListBox);

            tabs.TabPages.AddRange(new[] { connectionPage, healthPage, operationsPage, logPage });

            var status = new StatusStrip { SizingGrip = false };
            status.Items.Add(statusLabel);
            status.Items.Add(databaseLabel);

            Controls.Add(tabs);
            Controls.Add(status);
        }

        private Control BuildConnectionPage()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Top,
                AutoSize = true,
                ColumnCount = 2,
                Padding = new Padding(0, 4, 0, 0)
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

            layout.Controls.Add(RowLabel("MongoDB URI"), 0, 0);
            layout.Controls.Add(uriTextBox, 1, 0);
            layout.Controls.Add(RowLabel("Database"), 0, 1);
            layout.Controls.Add(databaseTextBox, 1, 1);

            var testButton = new Button { Text = "Test connection", AutoSize = true, Padding = new Padding(10, 2, 10, 2) };
            testButton.Click += (_, _) => Run("Test connection", TestConnection);
            layout.Controls.Add(testButton, 1, 2);
            layout.Controls.Add(connectionStatus, 1, 3);

            var hint = new Label
            {
                AutoSize = true,
                MaximumSize = new Size(760, 0),
                ForeColor = SystemColors.GrayText,
                Padding = new Padding(0, 18, 0, 0),
                Text = "The console reads the same catalog/*.json the server seeds from. "
                    + "URI falls back to MONGODB_URI, then mongodb://localhost:27017."
            };
            layout.Controls.Add(hint, 0, 4);
            layout.SetColumnSpan(hint, 2);
            return layout;
        }

        private Control BuildHealthPage()
        {
            healthView.Columns.Add("Collection", 220);
            healthView.Columns.Add("Documents", 120);

            var top = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                AutoSize = true,
                Padding = new Padding(0, 0, 0, 8)
            };
            var refresh = new Button { Text = "Refresh", AutoSize = true, Padding = new Padding(10, 2, 10, 2) };
            refresh.Click += (_, _) => Run("Refresh health", RefreshHealth);
            top.Controls.Add(refresh);
            top.Controls.Add(pingLabel);

            var host = new Panel { Dock = DockStyle.Fill };
            host.Controls.Add(healthView);
            host.Controls.Add(top);
            return host;
        }

        private Control BuildOperationsPage()
        {
            var layout = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoScroll = true
            };

            layout.Controls.Add(SectionTitle("Reset catalog"));
            layout.Controls.Add(SectionHint(
                "Drops the six catalog collections and reseeds them from catalog/*.json. "
                + "A backup is written first and the reset aborts if it fails. "
                + "Refused when the admin account is missing."));
            var resetButton = new Button { Text = "Reset catalog...", AutoSize = true, Padding = new Padding(10, 2, 10, 2) };
            resetButton.Click += (_, _) => Run("Reset catalog", ResetCatalog);
            layout.Controls.Add(resetButton);

            layout.Controls.Add(SectionTitle("Recalculate best post"));
            layout.Controls.Add(SectionHint("Picks the ingredient post with the most points as the best post."));
            var recalcRow = new TableLayoutPanel { AutoSize = true, ColumnCount = 2, Width = 560 };
            recalcRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            recalcRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            recalcRow.Controls.Add(ingredientIdTextBox, 0, 0);
            var recalcButton = new Button { Text = "Recalculate", AutoSize = true, Padding = new Padding(10, 2, 10, 2) };
            recalcButton.Click += (_, _) => Run("Recalculate best post", RecalculateBestPost);
            recalcRow.Controls.Add(recalcButton, 1, 0);
            layout.Controls.Add(recalcRow);

            layout.Controls.Add(SectionTitle("Backup"));
            layout.Controls.Add(SectionHint(
                "Writes the same gzip archive the admin page restores: six catalog collections plus users. "
                + "The admin page lists only backup-YYYYMMDD-HHmmss.json.gz files inside BACKUP_DIR."));
            var backupButton = new Button { Text = "Write backup to file...", AutoSize = true, Padding = new Padding(10, 2, 10, 2) };
            backupButton.Click += (_, _) => Run("Backup", BackupToFile);
            layout.Controls.Add(backupButton);

            layout.Controls.Add(SectionTitle("Restore"));
            layout.Controls.Add(SectionHint(
                "Replaces the six catalog collections from an archive. A backup of the current data is "
                + "written first; users, roles, audit rows and jobs are not touched."));
            var restoreButton = new Button { Text = "Restore from file...", AutoSize = true, Padding = new Padding(10, 2, 10, 2) };
            restoreButton.Click += (_, _) => Run("Restore", RestoreFromFile);
            layout.Controls.Add(restoreButton);

            return layout;
        }

        private static Label RowLabel(string text)
        {
            return new Label { Text = text, AutoSize = true, Padding = new Padding(0, 6, 0, 0) };
        }

        private static Label SectionTitle(string text)
        {
            return new Label
            {
                Text = text,
                AutoSize = true,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                Padding = new Padding(0, 18, 0, 2)
            };
        }

        private static Label SectionHint(string text)
        {
            return new Label
            {
                Text = text,
                AutoSize = true,
                ForeColor = SystemColors.GrayText,
                MaximumSize = new Size(620, 0),
                Padding = new Padding(0, 0, 0, 6)
            };
        }

        private string TestConnection()
        {
            var database = OpenDatabase();
            var stopwatch = Stopwatch.StartNew();
            database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            stopwatch.Stop();
            connectionStatus.Text = $"Connected to {database.DatabaseNamespace.DatabaseName} in "
                + $"{Math.Round(stopwatch.Elapsed.TotalMilliseconds, 0)} ms.";
            connectionStatus.ForeColor = SystemColors.ControlText;
            databaseLabel.Text = database.DatabaseNamespace.DatabaseName;
            return connectionStatus.Text;
        }

        private string RefreshHealth()
        {
            var database = OpenDatabase();
            var stopwatch = Stopwatch.StartNew();
            database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            stopwatch.Stop();

            healthView.BeginUpdate();
            healthView.Items.Clear();
            foreach (var name in BackupArchive.CatalogCollections)
            {
                var count = database.GetCollection<BsonDocument>(name)
                    .CountDocuments(FilterDefinition<BsonDocument>.Empty);
                var row = new ListViewItem(name);
                row.SubItems.Add(count.ToString("N0"));
                healthView.Items.Add(row);
            }
            healthView.EndUpdate();

            pingLabel.Text = "Ping " + Math.Round(stopwatch.Elapsed.TotalMilliseconds, 0) + " ms";
            return "Health: ping " + Math.Round(stopwatch.Elapsed.TotalMilliseconds, 0)
                + " ms, database " + database.DatabaseNamespace.DatabaseName + ".";
        }

        private string ResetCatalog()
        {
            var database = OpenDatabase();
            database_seed.DatabaseSeed.RequireAdmin(database);
            if (!ConfirmWord("Confirm reset", "RESET",
                    "This drops the six catalog collections and reseeds them from catalog/*.json. "
                    + "Users, roles, audit rows and jobs stay untouched.\n\nType RESET to continue."))
            {
                return "Reset cancelled.";
            }

            var backupPath = ChooseBackupPath("backup-before-reset");
            if (backupPath == null)
            {
                return "Reset cancelled.";
            }
            var info = BackupArchive.Write(database, backupPath);
            AppLog.Log(AppLogType.Comment, "Reset backup written to " + info.File);

            database_seed.DatabaseSeed.Init(uriTextBox.Text.Trim(), DatabaseName());
            var message = "Catalog reset from catalog/*.json. Backup: " + info.File;
            MessageBox.Show(this, message, "Reset complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return message;
        }

        private string RecalculateBestPost()
        {
            var ingredientId = ingredientIdTextBox.Text.Trim();
            if (!ObjectId.TryParse(ingredientId, out _))
            {
                throw new InvalidOperationException("Enter a 24-character hex ingredient id.");
            }
            if (!IngredientVoteBestPost.Update(ingredientId, uriTextBox.Text.Trim(), DatabaseName()))
            {
                throw new InvalidOperationException("No ingredient or posts were found for " + ingredientId + ".");
            }
            ingredientIdTextBox.Text = "";
            return "Best post recalculated for " + ingredientId + ".";
        }

        private string BackupToFile()
        {
            var path = ChooseBackupPath("backup");
            if (path == null)
            {
                return "Backup cancelled.";
            }
            var info = BackupArchive.Write(OpenDatabase(), path);
            MessageBox.Show(this,
                $"Backup written.\n\n{info.File}\n{info.Bytes} bytes\n\n"
                + "Restore from /admin: copy it into " + RestoreDirectory()
                + " keeping a backup-YYYYMMDD-HHmmss.json.gz name.",
                "Backup complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return "Backup written to " + info.File + ".";
        }

        private string RestoreFromFile()
        {
            using var dialog = new OpenFileDialog
            {
                Title = "Restore catalog from backup",
                Filter = "Backup archive (*.json.gz)|*.json.gz|All files (*.*)|*.*",
                CheckFileExists = true
            };
            if (dialog.ShowDialog(this) != DialogResult.OK)
            {
                return "Restore cancelled.";
            }

            var archive = BackupArchive.Read(dialog.FileName);
            if (!ConfirmWord("Confirm restore", "RESTORE",
                    "This replaces the six catalog collections with the archive contents.\n\n"
                    + dialog.FileName + "\n\nType RESTORE to continue."))
            {
                return "Restore cancelled.";
            }

            var database = OpenDatabase();
            var backupPath = ChooseBackupPath("backup-before-restore");
            if (backupPath == null)
            {
                return "Restore cancelled.";
            }
            var info = BackupArchive.Write(database, backupPath);
            AppLog.Log(AppLogType.Comment, "Pre-restore backup written to " + info.File);

            BackupArchive.Restore(database, archive);
            var message = "Catalog restored from " + dialog.FileName + ". Previous data saved to " + info.File + ".";
            MessageBox.Show(this, message, "Restore complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return message;
        }

        private static string RestoreDirectory()
        {
            var configured = Environment.GetEnvironmentVariable("BACKUP_DIR");
            return string.IsNullOrWhiteSpace(configured)
                ? "the server BACKUP_DIR (server\\backups locally, /app/backups in Compose)"
                : configured;
        }

        private string? ChooseBackupPath(string prefix)
        {
            var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
            //The operator-facing backup must keep the name /admin lists; safety copies may not.
            using var dialog = new SaveFileDialog
            {
                Title = "Choose the backup file",
                Filter = "Backup archive (*.json.gz)|*.json.gz|All files (*.*)|*.*",
                FileName = prefix == "backup"
                    ? BackupArchive.DefaultFileName(DateTime.UtcNow)
                    : $"{prefix}-{stamp}.json.gz",
                InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                OverwritePrompt = true
            };
            return dialog.ShowDialog(this) == DialogResult.OK ? dialog.FileName : null;
        }

        private bool ConfirmWord(string title, string word, string body)
        {
            using var dialog = new Form
            {
                Text = title,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                StartPosition = FormStartPosition.CenterParent,
                MinimizeBox = false,
                MaximizeBox = false,
                ClientSize = new Size(480, 250),
                Padding = new Padding(14)
            };
            var textBox = new TextBox { Dock = DockStyle.Bottom };
            var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, Dock = DockStyle.Right, Width = 90 };
            var confirm = new Button { Text = "Continue", DialogResult = DialogResult.OK, Dock = DockStyle.Right, Width = 90 };
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, AutoSize = true };
            buttons.Controls.Add(cancel);
            buttons.Controls.Add(confirm);
            var label = new Label { Text = body, Dock = DockStyle.Fill };
            var typeHint = new Label { Text = "Type " + word + ":", Dock = DockStyle.Bottom, AutoSize = true, Padding = new Padding(0, 8, 0, 4) };

            dialog.Controls.Add(label);
            dialog.Controls.Add(typeHint);
            dialog.Controls.Add(textBox);
            dialog.Controls.Add(buttons);
            dialog.AcceptButton = confirm;
            dialog.CancelButton = cancel;

            var accepted = dialog.ShowDialog(this) == DialogResult.OK;
            return accepted && string.Equals(textBox.Text.Trim(), word, StringComparison.OrdinalIgnoreCase);
        }

        private IMongoDatabase OpenDatabase()
        {
            var uri = uriTextBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(uri))
            {
                throw new InvalidOperationException("Enter a MongoDB URI.");
            }
            var settings = MongoClientSettings.FromConnectionString(uri);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
            return new MongoClient(settings).GetDatabase(DatabaseName());
        }

        private string DatabaseName()
        {
            var name = databaseTextBox.Text.Trim();
            return string.IsNullOrWhiteSpace(name) ? database_seed.DatabaseSeed.DatabaseName : name;
        }

        private void Run(string action, Func<string> work)
        {
            try
            {
                UseWaitCursor = true;
                var message = work();
                statusLabel.Text = message;
                AppLog.Log(AppLogType.Comment, message);
            }
            catch (Exception error)
            {
                statusLabel.Text = action + " failed.";
                AppLog.Log(AppLogType.Exception, action + " failed: " + error.Message);
                MessageBox.Show(this, error.Message, action + " failed",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                UseWaitCursor = false;
            }
        }

        private void HandleLog(string message)
        {
            if (IsDisposed)
            {
                return;
            }
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(HandleLog), message);
                return;
            }
            logListBox.Items.Add(message);
            logListBox.TopIndex = Math.Max(logListBox.Items.Count - 1, 0);
        }
    }
}
