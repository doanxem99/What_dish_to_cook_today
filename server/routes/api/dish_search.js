const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');

const getDishPostSearchDetail = function(_dishId, _dishName, _dishPostId, _callBack){
    database.collections.DishPost.findById(_dishPostId, "short_detail", function(_err, _response){
        if(!_err){
            _callBack({
                "id" : _dishId,
                "name" : _dishName,
                "short_detail" : _response.short_detail
            });
        }
        else{
            _callBack({
                "id" : _dishId,
                "name" : _dishName,
                "short_detail" : null
            });
        }
    });
}
const findDishsByKeyword = function(_keyword, _callBack)
{
    //- Find with keyword
    //- Only get result have bestPost
    database.collections.Dish.find({name : { "$regex": _keyword, "$options": "i" }, best_post_id: { $exists: true, $ne: "" }}, 'name best_post_id',function(_err, _response){
        if(!_err){
            let numberTaskWaiting = _response.length;
            let dataReturn = [];
            for(let subData of _response){
                //loop to get detail each dish
                getDishPostSearchDetail(subData._id, subData.name, subData.best_post_id, function(_data){
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
router.get('/', function(req, res){
    findDishsByKeyword("", (_data) => {
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
    findDishsByKeyword("", (_data) => {
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