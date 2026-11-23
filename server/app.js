const path = require('path');
const crypto = require('crypto');
const express = require('express');
const busboy = require('connect-busboy');
const adminJobs = require('./config/admin/jobs');
const adminMaintenance = require('./config/admin/maintenance');
const database = require('./config/database/connection');
const appDebug = require('./config/debug/app_debug');
const cookieParser = require('cookie-parser');

 //*Create app
const app = express();

//Only trust X-Forwarded-* when the app really runs behind a proxy (reverse proxy, PaaS)
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('./config/body_error'));

app.use(cookieParser());

//Flutter need cors to work with api.
const { corsForRequest } = require('./config/cors');

app.use((req, res, next) => corsForRequest()(req, res, next));

//Max upload size is 5 MB
app.use(busboy({ limits: { fileSize: 5 * 1024 * 1024 } }));

//A random JWT secret is used when none is configured, so missing config is not a crash.
//Tokens from before a restart are rejected in that case.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET is not set. Using a random secret; logins will not survive a restart.');
}

//*Init
appDebug.init();

//*Set public folder
const rootPath = __dirname;
app.use("/public", express.static(path.join(rootPath, 'public')));

//Public API answers 503 while a destructive job runs
app.use(adminMaintenance.maintenanceMiddleware);

//* Add router listener
//+ API
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/health', require('./routes/api/health'));
app.use('/api/admin', require('./routes/api/admin'));
app.use('/api/ingredient', require('./routes/api/ingredient'));
app.use('/api/dish', require('./routes/api/dish'));
app.use('/api/template', require('./routes/api/template'));
app.use('/api/gallery_upload', require('./routes/api/gallery_upload'));
app.use('/api/translate', require('./routes/api/translate'));
app.use('/api/ai', require('./routes/api/ai'));

//Built clients: Vue at /, Flutter at /flutter
app.use(require('./routes/web/static_site')({
  vueRoot: path.join(rootPath, 'web_ui'),
  flutterRoot: path.join(rootPath, 'web'),
}));

//(*)Add error router handle at last
app.use(require('./routes/web/error.js'));

//*************Need create edit page for dish
//*************For ingredient type, allow multiple types and have UI/UX like ingredients using of dish */
//For generate box, we change to look like edit page(Only need show name, type, short detail and image)
//If user want to change, they can click on edit button to show box for edit


//*Listening
app.listen("3000", async () => {
  console.log('Begin listening on port 3000');

  //Recovery and admin promotion both read Mongo, so wait for the connection first
  try {
    await database.mongoose.connection.asPromise();
  } catch (error) {
    console.error('Startup could not reach MongoDB: ' + error.message);
  }

  //A row left queued or running by the previous process can never finish
  try {
    await adminJobs.markInterruptedJobs();
  } catch (error) {
    console.error('Cannot recover interrupted jobs: ' + error.message);
  }

  //Promote ADMIN_USERNAME when it is set and the account exists.
  //It logs one line for promoted, already admin and skipped.
  await require('./routes/api/auth').promoteAdmin();

  //Admin jobs run in-process, one at a time.
  const jobTimer = setInterval(() => {
    adminJobs.runNextJob().catch((error) => {
      console.error('Job runner error: ' + error.message);
    });
  }, 2000);
  jobTimer.unref();
});
