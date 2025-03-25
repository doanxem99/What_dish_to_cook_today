const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next){
    next();
});

router.use('/search', require('./ingredient_search'));
router.use('/selection', require('./ingredient_selection'));
router.use('/profile', require('./ingredient_profile'));

//export this router to use in our index.js
module.exports = router;