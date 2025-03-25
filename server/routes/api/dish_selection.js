const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const getDishData = function(_dishId, _callBack){
    database.collections.Dish.findById(_dishId, "name", function(_err, _response){
        if(!_err){
            _callBack(_response);
        }
        else{
            _callBack(null);
        }
    });
}

const findDishSelection = function(_callBack){
    //- Read all dish post is best post
    //Limit 10 item
    database.collections.DishPost.find({is_best_post : true}, "dish_id short_detail profile_image", function(_err, _response){
        if(!_err){
            let numberTaskWaiting = _response.length;
            let dataReturn = [];
            for(let subData of _response){
                //loop to get data each dish
                getDishData(subData.dish_id, function(_data){
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

const findDishSelectionByIngredients = function(_ingredientIds, _callBack){
    let ingredientIds = _ingredientIds.split("-");
    //- Read all dish post is best post and contain _ingredientId
    //Limit 10 item
    database.collections.DishPost.find({is_best_post : true, ingredients : { $in : ingredientIds }}, "dish_id short_detail profile_image", function(_err, _response){
        if(!_err){
            let numberTaskWaiting = _response.length;
            let dataReturn = [];
            for(let subData of _response){
                //loop to get data each dish
                getDishData(subData.dish_id, function(_data){
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
    findDishSelection((_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});
router.get('/ingredients/', function(req, res){
    findDishSelection((_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});
router.get('/ingredients/:ingredientIds', function(req, res){
    findDishSelectionByIngredients(req.params.ingredientIds, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});

//export this router to use in our index.js
module.exports = router;