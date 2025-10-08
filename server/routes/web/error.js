const express = require('express');
const router = express.Router();

router.all('.', function(err, req, res){
    res.send('Not found');
});

//export this router to use in our index.js
module.exports = router;