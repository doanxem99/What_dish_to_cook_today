const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const findIngredientSelection = async function(){
    //- Read all ingredient post is best post
    //Limit 10 item
    const ingredientPosts = await database.collections.IngredientPost.find(
                        {is_best_post : true}, 
                        "ingredient_id short_detail short_detail_vi profile_image type nutrition"
                    ).limit(30);

    const ingredients = await database.collections.Ingredient.find(
        { _id: { $in: ingredientPosts.map(post => post.ingredient_id) } },
        "name name_vi"
    );
    const ingredientNames = new Map(ingredients.map(ingredient => [ingredient._id.toString(), ingredient]));

    const dataReturn = ingredientPosts
        .filter(post => ingredientNames.has(post.ingredient_id.toString()))
        .map(post => {
            const ingredient = ingredientNames.get(post.ingredient_id.toString());
            return {
                "id" : post.ingredient_id,
                "name" : ingredient.name,
                "name_vi" : ingredient.name_vi || null,
                "type" : post.type,
                "short_detail" : post.short_detail,
                "short_detail_vi" : post.short_detail_vi || null,
                "profile_image" : post.profile_image,
                "nutrition" : post.nutrition || null,
            };
        });

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
