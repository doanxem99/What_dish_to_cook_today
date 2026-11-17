const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

//Escape user input so a keyword like "a.*b" is matched as plain text
const escapeRegex = function(_text){
    return String(_text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const findDishsByKeyword = async function(_keyword)
{
    //- Find with keyword in English or Vietnamese
    //- Only get result have bestPost
    const nameFilter = { "$regex": escapeRegex(_keyword), "$options": "i" };
    const dishs = await database.collections.Dish.find(
        { $or: [ { name: nameFilter }, { name_vi: nameFilter } ], best_post_id: { $exists: true, $ne: "" } },
        'name name_vi best_post_id'
    ).limit(24);

    const dishPosts = await database.collections.DishPost.find(
        { _id: { $in: dishs.map(dish => dish.best_post_id) } },
        'short_detail short_detail_vi'
    );
    const dishPostDetails = new Map(dishPosts.map(post => [post._id.toString(), post]));

    return dishs.map(dish => {
        const post = dishPostDetails.get(dish.best_post_id.toString());
        return {
            "id" : dish._id,
            "name" : dish.name,
            "name_vi" : dish.name_vi || null,
            "short_detail" : post ? post.short_detail : null,
            "short_detail_vi" : post ? (post.short_detail_vi || null) : null,
        };
    });
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
