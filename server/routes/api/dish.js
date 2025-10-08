const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next){
    next();
});

router.use('/profile', require('./dish_profile'));
router.use('/search', require('./dish_search'));
router.use('/selection', require('./dish_selection'));

//export this router to use in our index.js
module.exports = router;