const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const getIngredientData = function(_ingredientId, _callBack){
    database.collections.Ingredient.findById(_ingredientId, "name", function(_err, _response){
        if(!_err){
            _callBack(_response);
        }
        else{
            _callBack(null);
        }
    });
}

const findIngredientSelection = function(_callBack){
    //- Read all ingredient post is best post
    //Limit 10 item
    database.collections.IngredientPost.find({is_best_post : true}, "ingredient_id short_detail profile_image", function(_err, _response){
        if(!_err){
            let numberTaskWaiting = _response.length;
            let dataReturn = [];
            for(let subData of _response){
                //loop to get data each ingredient
                getIngredientData(subData.ingredient_id, function(_data){
                    //Add data
                    if(_data != null){
                        dataReturn.push({
                            "id" : _data._id,
                            "name" : _data.name,
                            "short_detail" : subData.short_detail,
                            "profile_image" : subData.profile_image,
                        });
                    }
                    //Minus a numberTaskWaiting
                    numberTaskWaiting--;
                    //If numberTaskWaiting = 0, we call back
                    if(numberTaskWaiting == 0){
                        _callBack({'isSuccess' : true, 'data' : dataReturn});
                    }
                });
            }
        }
        else{
            _callBack(null);
        }
    }).limit(10);
}

router.get('/', function(req, res){
    findIngredientSelection((_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});

//export this router to use in our index.js
module.exports = router;