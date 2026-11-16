const express = require('express');
const router = express.Router();

//No route matched
router.use(function(req, res){
    res.status(404).send('Not found');
});

//Any error thrown by a route
router.use(function(err, req, res, next){
    console.error(err);
    res.status(err.status || 500).send(err.status ? err.message : 'Internal server error');
});

//export this router to use in our index.js
module.exports = router;
