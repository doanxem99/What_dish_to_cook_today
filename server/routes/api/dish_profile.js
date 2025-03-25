const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const fileAction = require('../../config/file/file_action');
const templateImage = require('../../config/template/template_image');
const path = require('path');
const workerCenter = require('../../config/worker/worker_center');
const appDebug = require('../../config/debug/app_debug');
const profileEnum = require('../../config/enum/profile_enum');

const setDishBestPost = function(_dishId, _dishPosId, _callBack){
    appDebug.writeLine(appDebug.DebugType.Comment, "Set dish best post");

    let isSuccess = true;
    let actionHandling = 2;
    //Set data for dish
    database.collections.Dish.findByIdAndUpdate(_dishId, { best_post_id: _dishPosId }, function (_err, _res) {
        if(isSuccess){
            if (!_err){
                actionHandling--;
                if(actionHandling == 0){
                    appDebug.writeLine(appDebug.DebugType.Comment, "Success set dish best post");
                    _callBack({
                        "status" : profileEnum.ProfileStatus_SetBestPost.Success
                    });
                }
            }
            else{
                appDebug.writeLine(appDebug.DebugType.Exception, "Error : " + _err);
                isSuccess = false;
                _callBack({
                    "status" : profileEnum.ProfileStatus_SetBestPost.Exception,
                    "detail" : _err
                });
            }
        }
    });
    //Set data for dish post
    database.collections.DishPost.findByIdAndUpdate(_dishPosId, { is_best_post: true }, function (_err, _res) {
        if(isSuccess){
            if (!_err){
                actionHandling--;
                if(actionHandling == 0){
                    appDebug.writeLine(appDebug.DebugType.Comment, "Success set dish best post");
                    _callBack({
                        "status" : profileEnum.ProfileStatus_SetBestPost.Success
                    });
                }
            }
            else{
                appDebug.writeLine(appDebug.DebugType.Exception, "Error : " + _err);
                isSuccess = false;
                _callBack({
                    "status" : profileEnum.ProfileStatus_SetBestPost.Exception,
                    "detail" : _err
                });
            }
        }
    });
}

const createDishPost = function(_postData, _callBack)
{
    //*First, we try to create a dish post
    //If this user aready create post for this dish
    //We edit the current post
    let dish_id = _postData.dish_id;
    let user_id = "unknow";
    let unique_id = dish_id + "_" + user_id;
    let ingredients = _postData.data.ingredients;
    let short_detail = _postData.data.short_detail;
    let profile_image = _postData.data.profile_image;
    let display_blocks = _postData.data.display_blocks;

    let dishPostData = {
        'dish_id' : dish_id, 
        'user_id' : user_id,
        'unique_id' : unique_id,
        'date_time' : new Date().toJSON(),
        'ingredients' : ingredients,
        'short_detail' : short_detail,
        'profile_image' : profile_image,
        'display_blocks' : display_blocks
    };

    appDebug.writeLine(appDebug.DebugType.Comment, "Create dish post : " + unique_id);
    //Find all temporary files and move it to dish folder
    let dishFolderPath = 'public/gallery/dishs/' + dish_id + "/" + user_id + "/";
    let temporaryFolderPath = 'public/gallery/temporary/';
    fileAction.findFilePathsAndMove(dishPostData, path.join(__dirname, '../../'), temporaryFolderPath, dishFolderPath, (_newDishPostData) => {
        //Try to create a dish post
        database.collections.DishPost.create(_newDishPostData, function (_err, _res) {
            if (!_err){
                appDebug.writeLine(appDebug.DebugType.Comment, "Success create dish post");
                _callBack({
                    'status' : profileEnum.ProfileStatus_PostCreate.CreatingSuccess,
                    'detail' : "Success create dish post",
                    'dish_post_id' : _res._id
                });
            }
            else{
                //If this user aready create dish post for this dish
                //We edit the current dish post
                database.collections.DishPost.updateOne({ unique_id: unique_id }, _newDishPostData, function(_err, _res) {
                    if(!_err){
                        appDebug.writeLine(appDebug.DebugType.Comment, "Success edit dish post");
                        _callBack({
                            'status' : profileEnum.ProfileStatus_PostCreate.EditingSuccess,
                            'detail' : "Success edit dish post",
                            'dish_post_id' : _res._id
                        });
                    }
                    else{
                        appDebug.writeLine(appDebug.DebugType.Exception, _err);
                        _callBack({
                            'status' : profileEnum.ProfileStatus_PostCreate.Exception,
                            'detail' : _err
                        });
                    }
                });
            }
        });
        
    });
}
const createDish = function(_postData, _callBack){
    //*First, we convert name to right format : 
    //Only allow name contain letter
    //Begin letter is upcase and other is lower case
    //*Then, try to create Dish with this name
    //If aready exist, we return status existed
    let dishName = _postData.name;
    let ingredients = _postData.ingredients;
    let short_detail = _postData.short_detail;
    let profile_image = _postData.profile_image;
    appDebug.writeLine(appDebug.DebugType.Comment, "Create dish : " + dishName);
    if (/^[A-Za-z _]+$/.test(dishName)){
        let dishData = {
            'name' : dishName, 
            'best_post_id' : "",
            'is_need_update' : false
        };

        database.collections.Dish.create(dishData, function (_err, _res) {
            if (!_err){
                appDebug.writeLine(appDebug.DebugType.Comment, "Success create dish");
                let dishId = _res._id;
                //Add dish post data
                let ingrdientPostData = {
                    'dish_id' : dishId,
                    'data' : {
                        'ingredients' : ingredients,
                        'short_detail' : short_detail,
                        'profile_image' : profile_image,
                        'display_blocks' : []
                    }
                }
                createDishPost(ingrdientPostData, function(_data) {
                    if(_data.status == profileEnum.ProfileStatus_PostCreate.CreatingSuccess)
                    {
                        //Set this dishPost is best post
                        let dishPostId = _data.dish_post_id;
                        setDishBestPost(dishId, dishPostId, function(_data){
                            if(_data.status == profileEnum.ProfileStatus_SetBestPost.Success){
                                _callBack({
                                    "status" : profileEnum.ProfileStatus_Create.Success,
                                    "dish_id" : dishId,
                                    "detail" : "Success create dish"
                                });
                            }
                            else{
                                _callBack({
                                    "status" : profileEnum.ProfileStatus_Create.Exception,
                                    "detail" : _data.detail
                                });
                            }
                        });
                    }
                    else
                    {
                        appDebug.writeLine(appDebug.DebugType.Comment, "Failed to create dish post");
                        _callBack({
                            "status" : profileEnum.ProfileStatus_Create.Exception,
                            "detail" : _data.detail
                        });
                    }
                });
            }
            else{
                appDebug.writeLine(appDebug.DebugType.Exception, "Dish name aready used");
                _callBack({
                    "status" : profileEnum.ProfileStatus_Create.NameUsed,
                    "detail" : "Dish name aready used"
                });
            }
        });
    }
    else{
        _callBack({
            "status" : profileEnum.ProfileStatus_Create.NameFormatException,
            "detail" : "Dish name only allow letter and space"
        });
        appDebug.writeLine(appDebug.DebugType.Exception, "Dish name only allow letter and space");
    }
}
const getDishDetail = function(_dishId, _callBack)
{
    database.collections.Dish.findById(_dishId, 'name best_post_id',function(_err, _response){
        if(!_err){
            _callBack({
                'status' : profileEnum.ProfileStatus_Detail.Success, 
                'data' : _response
            });
        }
        else{
            _callBack({
                'status' : profileEnum.ProfileStatus_Detail.Exception, 'status' : _err
            });
        }
    });
}
const getDishPostDetail = function(_dishPostId, _callBack)
{
    database.collections.DishPost.findById(_dishPostId, 
        "dish_id user_id is_best_post date_time points ingredients short_detail profile_image display_blocks",
        function(_err, _response){
            if(!_err){
                _callBack({
                    'status' : profileEnum.ProfileStatus_PostDetail.Success,
                    'data' : _response
                });
            }
            else{
                _callBack({
                    'status' : profileEnum.ProfileStatus_PostDetail.Exception,
                    'detail' : _err
                });
            }
        });
}

router.post('/create_dish', function(req, res){
    createDish(req.body, (_dataReturn) => {
        res.statusCode = 200;
        res.send(_dataReturn);
    });
});
router.post('/create_dish_post', function(req, res){
    createDishPost(req.body, (_dataReturn) => {
        res.statusCode = 200;
        res.send(_dataReturn);
    });
});
router.get('/get_dish/:dish_id', function(req, res){
    getDishDetail(req.params.dish_id, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});
router.get('/get_dish_post/:dish_post_id', function(req, res){
    getDishPostDetail(req.params.dish_post_id, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});
router.get('/get_dish_posts/:dish_ids', function(req, res){
    getDishPostIds(req.params.dish_ids, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});

//export this router to use in our index.js
module.exports = router;