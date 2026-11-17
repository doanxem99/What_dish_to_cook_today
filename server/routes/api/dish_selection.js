const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

//The seed tools author their posts as this user; anything else is a user contribution
const SEED_ADMIN_USERNAME = 'moonshine@gmail.com';

const toPreviews = async function(_dishPosts) {
    const dishes = await database.collections.Dish.find(
        { _id: { $in: _dishPosts.map(post => post.dish_id) } },
        "name name_vi"
    );
    const dishById = new Map(dishes.map(dish => [dish._id.toString(), dish]));

    return _dishPosts
        .filter(post => dishById.has(post.dish_id.toString()))
        .map(post => {
            const dish = dishById.get(post.dish_id.toString());
            return {
                "id": dish._id,
                "name": dish.name,
                "name_vi": dish.name_vi || null,
                "short_detail": post.short_detail,
                "short_detail_vi": post.short_detail_vi || null,
                "profile_image": post.profile_image,
            };
        });
}

const findDishSelectionByIds = async function(_ingredientIds){
    //- Read all dish post is best post and contain _ingredientId
    //Limit 10 item
    const filter = { is_best_post: true };
    if (_ingredientIds.length > 0) {
        filter.ingredients = { $in: _ingredientIds };
    }
    const dishPosts = await database.collections.DishPost.find(
        filter,
        "dish_id short_detail short_detail_vi profile_image"
    ).limit(10);

    return toPreviews(dishPosts);
}

const findDishSelection = async function(){
    return findDishSelectionByIds([]);
}

const findHomemadeDishSelection = async function(){
    const seedAdmin = await database.collections.User.findOne({ username: SEED_ADMIN_USERNAME }, '_id');
    if (!seedAdmin) {
        //Without the seed admin the filter would show seed content as homemade
        return [];
    }

    const dishPosts = await database.collections.DishPost.find(
        { is_best_post: true, user_id: { $nin: ['unknow', seedAdmin._id.toString()] } },
        "dish_id short_detail short_detail_vi profile_image"
    ).limit(10);

    return toPreviews(dishPosts);
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
router.get('/homemade', async function(req, res){
    try {
        res.send({ 'isSuccess': true, 'data': await findHomemadeDishSelection() });
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
