const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const getIngredientPostSearchDetail = function(_ingredientId, _ingredientName, _ingredientPostId, _callBack){
    database.collections.IngredientPost.findById(_ingredientPostId, "short_detail", function(_err, _response){
        if(!_err){
            _callBack({
                "id" : _ingredientId,
                "name" : _ingredientName,
                // "short_detail" : _response.short_detail
            });
        }
        else{
            _callBack({
                "id" : _ingredientId,
                "name" : _ingredientName,
                // "short_detail" : null
            });
        }
    });
}
const findIngredientsByKeyword = function(_keyword, _callBack)
{
    //- Find with keyword
    //- Only get result have bestPost
    database.collections.Ingredient.find({name : { "$regex": _keyword, "$options": "i" }, best_post_id: { $exists: true, $ne: "" }}, 'name best_post_id',function(_err, _response){
        if(!_err){
            let numberTaskWaiting = _response.length;
            let dataReturn = [];
            for(let subData of _response){
                //loop to get detail each Ingredient
                getIngredientPostSearchDetail(subData._id, subData.name, subData.best_post_id, function(_data){
                    //Add data
                    dataReturn.push(_data);
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
            _callBack({'isSuccess' : false, 'status' : _err.toString()});
        }
    }).limit(10);
}

const findIngredientsByIds = function(_ids, _callBack)
{
    //- Find with id
    //- Only get result have at least 1 post
    //- Return id(default) , name, best_post_id, posts
    //- limit is 10 result
    database.collections.Ingredient.find({_id : { $in : _ids.toString().split('-') }}, 'name best_post_id',function(_err, _response){
        if(!_err){
            let numberTaskWaiting = _response.length;
            let dataReturn = [];
            for(let subData of _response){
                //loop to get detail each Ingredient
                getIngredientPostSearchDetail(subData._id, subData.name, subData.best_post_id, function(_data){
                    //Add data
                    dataReturn.push(_data);
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
            _callBack({'isSuccess' : false, 'status' : _err.toString()});
        }
    });
}

router.get('/', function(req, res){
    findIngredientsByKeyword("", (_data) => {
        if(_data.isSuccess){
            res.statusCode = 200;
            res.send(_data.data);
        }
        else{
            res.statusCode = 400;
            res.send(_data.status);
        }
    });
});
router.get('/keyword', function(req, res){
    findIngredientsByKeyword("", (_data) => {
        if(_data.isSuccess){
            res.statusCode = 200;
            res.send(_data.data);
        }
        else{
            res.statusCode = 400;
            res.send(_data.status);
        }
    });
});
router.get('/keyword/:keyword', function(req, res){
    findIngredientsByKeyword(req.params.keyword, (_data) => {
        if(_data.isSuccess){
            res.statusCode = 200;
            res.send(_data.data);
        }
        else{
            res.statusCode = 400;
            res.send(_data.status);
        }
    });
});
router.get('/ids/:ids', function(req, res){
    if (req.params.ids == "undefined" || req.params.ids == ""){
        res.statusCode = 400;
        res.send("ids is empty");
        return;
    }
    findIngredientsByIds(req.params.ids, (_data) => {
        if(_data.isSuccess){
            res.statusCode = 200;
            res.send(_data.data);
        }
        else{
            res.statusCode = 400;
            res.send(_data.status);
        }
    });
});

//export this router to use in our index.js
module.exports = router;