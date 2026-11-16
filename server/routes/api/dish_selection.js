const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const findDishSelectionByIds = async function(_ingredientIds){
    //- Read all dish post is best post and contain _ingredientId
    //Limit 10 item
    const filter = { is_best_post: true };
    if (_ingredientIds.length > 0) {
        filter.ingredients = { $in: _ingredientIds };
    }
    const dishPosts = await database.collections.DishPost.find(
        filter,
        "dish_id short_detail profile_image"
    ).limit(10);

    const dishes = await database.collections.Dish.find(
        { _id: { $in: dishPosts.map(post => post.dish_id) } },
        "name"
    );
    const dishNames = new Map(dishes.map(dish => [dish._id.toString(), dish.name]));

    return dishPosts
        .filter(post => dishNames.has(post.dish_id.toString()))
        .map(post => ({
            "id": post.dish_id,
            "name": dishNames.get(post.dish_id.toString()),
            "short_detail": post.short_detail,
            "profile_image": post.profile_image,
        }));
}

const findDishSelection = async function(){
    return findDishSelectionByIds([]);
}

router.get('/', async function(req, res){
    try {
        res.send({ 'isSuccess': true, 'data': await findDishSelection() });
    } catch (err) {
        res.status(500).send({ 'isSuccess': false, 'status': err.toString() });
    }
});
router.get('/ingredients/', async function(req, res){
    try {
        res.send({ 'isSuccess': true, 'data': await findDishSelection() });
    } catch (err) {
        res.status(500).send({ 'isSuccess': false, 'status': err.toString() });
    }
});
router.get('/ingredients/:ingredientIds', async function(req, res){
    try {
        const ingredientIds = req.params.ingredientIds.split('-').filter(id => id.length > 0);
        res.send({ 'isSuccess': true, 'data': await findDishSelectionByIds(ingredientIds) });
    } catch (err) {
        res.status(500).send({ 'isSuccess': false, 'status': err.toString() });
    }
});

//export this router to use in our index.js
module.exports = router;
