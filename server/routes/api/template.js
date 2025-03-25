const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const templateImage = require('../../config/template/template_image');
const templateIngredient = require('../../config/template/template_ingredient');
const templateDish = require('../../config/template/template_dish');

router.get('/ingredient', function(req, res){
    res.statusCode = 200;
    res.send(templateIngredient.templateIngredient);
});

router.get('/dish', function(req, res){
    res.statusCode = 200;
    res.send(templateDish.templateDish);
});

router.get('/image_block', function(req, res){
    res.statusCode = 200;
    res.send(templateImage.templateImageBlock);
});

//export this router to use in our index.js
module.exports = router;