const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const fileAction = require('../../config/file/file_action');
const templateImage = require('../../config/template/template_image');
const path = require('path');
const workerCenter = require('../../config/worker/worker_center');
const appDebug = require('../../config/debug/app_debug');
const profileEnum = require('../../config/enum/profile_enum');

const setIngredientBestPost = function(_ingredientId, _ingredientPosId, _callBack){
    appDebug.writeLine(appDebug.DebugType.Comment, "Set ingredient best post");

    let isSuccess = true;
    let actionHandling = 2;
    //Set data for ingredient
    database.collections.Ingredient.findByIdAndUpdate(_ingredientId, { best_post_id: _ingredientPosId }, function (_err, _res) {
        if(isSuccess){
            if (!_err){
                actionHandling--;
                if(actionHandling == 0){
                    appDebug.writeLine(appDebug.DebugType.Comment, "Success set ingredient best post");
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
    //Set data for ingredient post
    database.collections.IngredientPost.findByIdAndUpdate(_ingredientPosId, { is_best_post: true }, function (_err, _res) {
        if(isSuccess){
            if (!_err){
                actionHandling--;
                if(actionHandling == 0){
                    appDebug.writeLine(appDebug.DebugType.Comment, "Success set ingredient best post");
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

const createIngredientPost = function(_postData, _callBack)
{
    //*First, we try to create a ingredient post
    //If this user aready create post for this ingredient
    //We edit the current post
    let ingredient_id = _postData.ingredient_id;
    let user_id = "unknow";
    let unique_id = ingredient_id + "_" + user_id;
    let type = _postData.data.type;
    let short_detail = _postData.data.short_detail;
    let profile_image = _postData.data.profile_image;
    let display_blocks = _postData.data.display_blocks;

    let ingredientPostData = {
        'ingredient_id' : ingredient_id, 
        'user_id' : user_id,
        'unique_id' : unique_id,
        'date_time' : new Date().toJSON(),
        'type' : type,
        'short_detail' : short_detail,
        'profile_image' : profile_image,
        'display_blocks' : display_blocks
    };

    appDebug.writeLine(appDebug.DebugType.Comment, "Create ingredient post : " + unique_id);
    //Find all temporary files and move it to ingredient folder
    let ingredientFolderPath = 'public/gallery/ingredients/' + ingredient_id + "/" + user_id + "/";
    let temporaryFolderPath = 'public/gallery/temporary/';
    fileAction.findFilePathsAndMove(ingredientPostData, path.join(__dirname, '../../'), temporaryFolderPath, ingredientFolderPath, (_newIngredientPostData) => {
        //Try to create a ingredient post
        database.collections.IngredientPost.create(_newIngredientPostData, function (_err, _res) {
            if (!_err){
                appDebug.writeLine(appDebug.DebugType.Comment, "Success create ingredient post");
                _callBack({
                    'status' : profileEnum.ProfileStatus_PostCreate.CreatingSuccess,
                    'detail' : "Success create ingredient post",
                    'ingredient_post_id' : _res._id
                });
            }
            else{
                //If this user aready create ingredient post for this ingredient
                //We edit the current ingredient post
                database.collections.IngredientPost.updateOne({ unique_id: unique_id }, _newIngredientPostData, function(_err, _res) {
                    if(!_err){
                        appDebug.writeLine(appDebug.DebugType.Comment, "Success edit ingredient post");
                        _callBack({
                            'status' : profileEnum.ProfileStatus_PostCreate.EditingSuccess,
                            'detail' : "Success edit ingredient post",
                            'ingredient_post_id' : _res._id
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
const createIngredient = function(_postData, _callBack){
    //*First, we convert name to right format : 
    //Only allow name contain letter
    //Begin letter is upcase and other is lower case
    //*Then, try to create Ingredient with this name
    //If aready exist, we return status existed
    let ingredientName = _postData.name;
    let type = _postData.type;
    let short_detail = _postData.short_detail;
    let profile_image = _postData.profile_image;
    appDebug.writeLine(appDebug.DebugType.Comment, "Create ingredient : " + ingredientName);
    if (/^[A-Za-z _]+$/.test(ingredientName)){
        let ingredientData = {
            'name' : ingredientName, 
            'best_post_id' : "",
            'is_need_update' : false
        };

        database.collections.Ingredient.create(ingredientData, function (_err, _res) {
            if (!_err){
                appDebug.writeLine(appDebug.DebugType.Comment, "Success create ingredient");
                let ingredientId = _res._id;
                //Add ingredient post data
                let ingrdientPostData = {
                    'ingredient_id' : ingredientId,
                    'data' : {
                        'type' : type,
                        'short_detail' : short_detail,
                        'profile_image' : profile_image,
                        'display_blocks' : []
                    }
                }
                createIngredientPost(ingrdientPostData, function(_data) {
                    if(_data.status == profileEnum.ProfileStatus_PostCreate.CreatingSuccess)
                    {
                        //Set this ingredientPost is best post
                        let ingredientPostId = _data.ingredient_post_id;
                        setIngredientBestPost(ingredientId, ingredientPostId, function(_data){
                            if(_data.status == profileEnum.ProfileStatus_SetBestPost.Success){
                                _callBack({
                                    "status" : profileEnum.ProfileStatus_Create.Success,
                                    "ingredient_id" : ingredientId,
                                    "detail" : "Success create ingredient"
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
                        appDebug.writeLine(appDebug.DebugType.Comment, "Failed to create ingredient post");
                        _callBack({
                            "status" : profileEnum.ProfileStatus_Create.Exception,
                            "detail" : _data.detail
                        });
                    }
                });
            }
            else{
                appDebug.writeLine(appDebug.DebugType.Exception, "Ingredient name aready used");
                _callBack({
                    "status" : profileEnum.ProfileStatus_Create.NameUsed,
                    "detail" : "Ingredient name aready used"
                });
            }
        });
    }
    else{
        _callBack({
            "status" : profileEnum.ProfileStatus_Create.NameFormatException,
            "detail" : "Ingredient name only allow letter and space"
        });
        appDebug.writeLine(appDebug.DebugType.Exception, "Ingredient name only allow letter and space");
    }
}
const getIngredientDetail = function(_ingredientId, _callBack)
{
    database.collections.Ingredient.findById(_ingredientId, 'name best_post_id',function(_err, _response){
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
const getIngredientPostDetail = function(_ingredientPostId, _callBack)
{
    database.collections.IngredientPost.findById(_ingredientPostId, 
        "ingredient_id user_id is_best_post date_time points type short_detail profile_image display_blocks",
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

router.post('/create_ingredient', function(req, res){
    createIngredient(req.body, (_dataReturn) => {
        res.statusCode = 200;
        res.send(_dataReturn);
    });
});
router.post('/create_ingredient_post', function(req, res){
    createIngredientPost(req.body, (_dataReturn) => {
        res.statusCode = 200;
        res.send(_dataReturn);
    });
});
router.get('/get_ingredient/:ingredient_id', function(req, res){
    getIngredientDetail(req.params.ingredient_id, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});
router.get('/get_ingredient_post/:ingredient_post_id', function(req, res){
    getIngredientPostDetail(req.params.ingredient_post_id, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});
router.get('/get_ingredient_posts/:ingredient_ids', function(req, res){
    getIngredientPostIds(req.params.ingredient_ids, (_data) => {
        res.statusCode = 200;
        res.send(_data);
    });
});

//export this router to use in our index.js
module.exports = router;