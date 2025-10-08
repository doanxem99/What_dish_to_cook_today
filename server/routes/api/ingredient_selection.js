const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const { cat } = require('shelljs');

const getIngredientData = async function(_ingredientId) {
    try {
        _response = await database.collections.Ingredient.findById(_ingredientId, "name");
        return _response;
    } catch (_err) {
        return null;
    }
}

const findIngredientSelection = async function(){
    //- Read all ingredient post is best post
    //Limit 10 item
    try {
        const _result = await database.collections.IngredientPost.find(
                            {is_best_post : true}, 
                            "ingredient_id short_detail profile_image type"
                        ).limit(10);
        if (_result == null) {
            return {
                statusCode: 500,
                isSuccess: false,
                message: "Error when get ingredient selection"
            }
        }
        let numberTaskWaiting = _result.length;
        let dataReturn = [];
        for(let subData of _result){
            //loop to get data each ingredient
            _data = await getIngredientData(subData.ingredient_id);
            //Add data
            if(_data != null){
                dataReturn.push({
                    "id" : _data._id,
                    "name" : _data.name,
                    "type" : subData.type,
                    "short_detail" : subData.short_detail,
                    "profile_image" : subData.profile_image,
                });
            }
            //Minus a numberTaskWaiting
            numberTaskWaiting--;
            //If numberTaskWaiting = 0, we return data
            if(numberTaskWaiting == 0){
                return {
                    statusCode: 200,
                    isSuccess: true,
                    data: dataReturn
                }
            }
        }
    } catch (_err) {
        return {
            statusCode: 500, 
            isSuccess: false,
            message: "Error when get ingredient selection",
        }
    }
}

router.get('/', async function(req, res){
    _data = await findIngredientSelection();
    res.status(_data.statusCode).send({
        isSuccess: _data.isSuccess,
        data: _data.data,
        message: _data.message
    });
});

//export this router to use in our index.js
module.exports = router;