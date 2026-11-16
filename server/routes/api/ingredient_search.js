const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

//Escape user input so a keyword like "a.*b" is matched as plain text
const escapeRegex = function(_text){
    return String(_text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const findIngredientsByKeyword = async function(_keyword)
{
    //- Find with keyword
    //- Only get result have bestPost
    const ingredients = await database.collections.Ingredient.find(
        {name : { "$regex": escapeRegex(_keyword), "$options": "i" }, best_post_id: { $exists: true, $ne: "" }},
        'name best_post_id'
    ).limit(10);

    return ingredients.map(ingredient => ({
        "id" : ingredient._id,
        "name" : ingredient.name,
    }));
}

const findIngredientsByIds = async function(_ids)
{
    //- Find with id
    //- Return id, name
    //- limit is 10 result
    const ingredients = await database.collections.Ingredient.find(
        {_id : { $in : _ids.split('-') }},
        'name best_post_id'
    ).limit(10);

    return ingredients.map(ingredient => ({
        "id" : ingredient._id,
        "name" : ingredient.name,
    }));
}

const sendList = async function(res, _task) {
    try {
        res.status(200).send(await _task());
    } catch (_err) {
        res.status(400).send(_err.toString());
    }
}

router.get('/', function(req, res){
    sendList(res, () => findIngredientsByKeyword(""));
});
router.get('/keyword', function(req, res){
    sendList(res, () => findIngredientsByKeyword(""));
});
router.get('/keyword/:keyword', function(req, res){
    sendList(res, () => findIngredientsByKeyword(req.params.keyword));
});
router.get('/ids/:ids', function(req, res){
    if (req.params.ids == "undefined" || req.params.ids == ""){
        res.statusCode = 400;
        res.send("ids is empty");
        return;
    }
    sendList(res, () => findIngredientsByIds(req.params.ids));
});

//export this router to use in our index.js
module.exports = router;
