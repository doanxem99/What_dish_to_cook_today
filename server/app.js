const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const busboy = require('connect-busboy');
const expressWs = require('express-ws');
const workerCenter = require('./config/worker/worker_center');
const appDebug = require('./config/debug/app_debug');
const cookieParser = require('cookie-parser');

 //*Create app
const app = express();

//Only trust X-Forwarded-* when the app really runs behind a proxy (reverse proxy, PaaS)
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

//*Use websocket on app
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

//Flutter need cors to work with api.
//Only localhost origins are allowed; set CORS_ORIGINS (comma separated) to add real domains.
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : defaultOrigins;
app.use(cors({
  origin: (origin, callback) => {
    //Same-origin and non-browser requests send no Origin header
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const error = new Error('Not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
}));

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

//Promote ADMIN_USERNAME (default moonshine@gmail.com) when the account exists
require('./routes/api/auth').promoteAdmin();

//*Set public folder
const rootPath = __dirname;
app.use("/public", express.static(path.join(rootPath, 'public')));

//* Add router listener
//+ API
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/ingredient', require('./routes/api/ingredient'));
app.use('/api/dish', require('./routes/api/dish'));
app.use('/api/template', require('./routes/api/template'));
app.use('/api/gallery_upload', require('./routes/api/gallery_upload'));
app.use('/api/translate', require('./routes/api/translate'));

//Built clients: Vue at /, Flutter at /flutter
app.use(require('./routes/web/static_site')({
  vueRoot: path.join(rootPath, 'web_ui'),
  flutterRoot: path.join(rootPath, 'web'),
}));

//Add websocket
app.ws('/worker', function(ws, req) {
  workerCenter.eventWorkerConnected(ws, req);
});

//(*)Add error router handle at last
app.use(require('./routes/web/error.js'));

//*************Need create edit page for dish
//*************For ingredient type, allow multiple types and have UI/UX like ingredients using of dish */
//For generate box, we change to look like edit page(Only need show name, type, short detail and image)
//If user want to change, they can click on edit button to show box for edit


//*Listening
app.listen("3000", () => {
  console.log('Begin listening on port 3000');

  workerCenter.startWorkers();
});
