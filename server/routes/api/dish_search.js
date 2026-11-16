const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

//Escape user input so a keyword like "a.*b" is matched as plain text
const escapeRegex = function(_text){
    return String(_text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const findDishsByKeyword = async function(_keyword)
{
    //- Find with keyword
    //- Only get result have bestPost
    const dishs = await database.collections.Dish.find(
        {name : { "$regex": escapeRegex(_keyword), "$options": "i" }, best_post_id: { $exists: true, $ne: "" }},
        'name best_post_id'
    ).limit(10);

    const dishPosts = await database.collections.DishPost.find(
        { _id: { $in: dishs.map(dish => dish.best_post_id) } },
        'short_detail'
    );
    const shortDetails = new Map(dishPosts.map(post => [post._id.toString(), post.short_detail]));

    return dishs.map(dish => ({
        "id" : dish._id,
        "name" : dish.name,
        "short_detail" : shortDetails.get(dish.best_post_id.toString()) || null,
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
    sendList(res, () => findDishsByKeyword(""));
});

router.get('/keyword', function(req, res){
    sendList(res, () => findDishsByKeyword(""));
});

router.get('/keyword/:keyword', function(req, res){
    sendList(res, () => findDishsByKeyword(req.params.keyword));
});

//export this router to use in our index.js
module.exports = router;
