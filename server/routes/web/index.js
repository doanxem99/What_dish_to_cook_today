const express = require('express');
const router = express.Router();

router.get('/', function(req, res){
    res.sendFile('index.html', { root: path.join(__dirname, '../../web') });
    //res.sendFile(__dirname + '/web/index.html');
    //res.send("Noshit");
});

router.get('/:page', function(req, res){
    res.redirect('/');
});

//export this router to use in our index.js
module.exports = router;