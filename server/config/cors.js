const cors = require('cors');

//Only localhost origins are allowed by default; set CORS_ORIGINS (comma separated) to add real domains.
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : defaultOrigins;

//The built Vue client sends an Origin header even for its own host, because the assets carry
//crossorigin. A deployment must list its own public origin in CORS_ORIGINS, and only that list
//grants access: the request's Host header is caller-controlled, so never trust it.
const corsForRequest = function() {
  return cors({
    origin: (origin, callback) => {
      //Non-browser requests send no Origin header
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const error = new Error('Not allowed by CORS');
      error.status = 403;
      return callback(error);
    },
    credentials: true,
  });
};

module.exports = { allowedOrigins, corsForRequest };
