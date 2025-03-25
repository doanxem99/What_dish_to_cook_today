const express = require('express');
const session = require('express-session');
const cors = require('cors')
const busboy = require('connect-busboy');
const expressWs = require('express-ws');
const workerCenter = require('./config/worker/worker_center');
const appDebug = require('./config/debug/app_debug');

 //*Create app
const app = express();

//*Use websocket on app
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Flutter need cors to work with api
app.use(cors());

app.use(busboy());

/*//Require no cache
const nocache = require('nocache');
app.use(nocache());*/

//*Set session
app.set('trust proxy', 1); // trust first proxy
app.use(session({
  secret: 'what_dish_to_cook_today',//If we change secret key, browser will watch this it new session
  resave: false,
  saveUninitialized: true,
  //cookie: { secure: true }//secure: true only work for https
}));

//*Init
appDebug.init();

//*Set public folder
app.use("/", express.static('web'));
app.use("/web", express.static('web'));
app.use("/public",express.static('public'));

//* Add router listener
//+ API
app.use('/api/ingredient', require('./routes/api/ingredient'));
app.use('/api/dish', require('./routes/api/dish'));
app.use('/api/template', require('./routes/api/template'));
app.use('/api/gallery_upload', require('./routes/api/gallery_upload'));
//+ Web
app.use('/web', require('./routes/web/index.js'));
//(*)Add error router handle at last
app.use(require('./routes/web/error.js'));

//Add websocket
app.ws('/worker', function(ws, req) {
  workerCenter.eventWorkerConnected(ws, req);
});

app.use('/testing', function(req, res){
  workerCenter.addRequestJob(workerCenter.WorkerType.DatabaseControl, "NoShit");
  res.send("abcd");
});
app.use('/testing2', function(req, res){
  workerCenter.addRequestJob(workerCenter.WorkerType.DatabaseControl, "ResetData");
  res.send("abcd");
});

//*************Need create edit page for dish
//*************For ingredient type, allow multiple types and have UI/UX like ingredients using of dish */
//For generate box, we change to look like edit page(Only need show name, type, short detail and image)
//If user want to change, they can click on edit button to show box for edit


//*Listening
app.listen("3000", () => {
  console.log('Begin listening');

  workerCenter.startWorkers();
});