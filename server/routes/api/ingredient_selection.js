const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const findIngredientSelection = async function(){
    //- Read all ingredient post is best post
    //Limit 10 item
    const ingredientPosts = await database.collections.IngredientPost.find(
                        {is_best_post : true}, 
                        "ingredient_id short_detail profile_image type"
                    ).limit(10);

    const ingredients = await database.collections.Ingredient.find(
        { _id: { $in: ingredientPosts.map(post => post.ingredient_id) } },
        "name"
    );
    const ingredientNames = new Map(ingredients.map(ingredient => [ingredient._id.toString(), ingredient.name]));

    const dataReturn = ingredientPosts
        .filter(post => ingredientNames.has(post.ingredient_id.toString()))
        .map(post => ({
            "id" : post.ingredient_id,
            "name" : ingredientNames.get(post.ingredient_id.toString()),
            "type" : post.type,
            "short_detail" : post.short_detail,
            "profile_image" : post.profile_image,
        }));

    return {
        statusCode: 200,
        isSuccess: true,
        data: dataReturn
    }
}

router.get('/', async function(req, res){
    try {
        const _data = await findIngredientSelection();
        res.status(_data.statusCode).send({
            isSuccess: _data.isSuccess,
            data: _data.data,
            message: _data.message
        });
    } catch (_err) {
        res.status(500).send({
            isSuccess: false,
            message: "Error when get ingredient selection",
        });
    }
});

//export this router to use in our index.js
module.exports = router;
