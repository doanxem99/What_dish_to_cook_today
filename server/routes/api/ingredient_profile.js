const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const fileAction = require('../../config/file/file_action');
const path = require('path');
const appDebug = require('../../config/debug/app_debug');
const profileEnum = require('../../config/enum/profile_enum');
const { verifyToken } = require('./verifyToken');
const { recordAudit } = require('../../config/admin/audit');

//A failed audit write must not undo a create that already succeeded.
const auditContent = function(req, action, targetType, targetId, detail) {
    const user = req.current_user || {};
    return recordAudit({
        actorId: user._id || req.body.userid || null,
        actorName: user.username || user.email || '',
        action,
        targetType,
        targetId,
        result: 'ok',
        detail,
        ip: req.ip || ''
    }).catch(() => {});
};

const findFilePathsAndMoveAsync = (dishPostData, rootPath, tempFolder, dishFolder) => {
    return new Promise((resolve, reject) => {
        fileAction.findFilePathsAndMove(dishPostData, rootPath, tempFolder, dishFolder, (newData) => {
            resolve(newData);
        });
    });
};

const setIngredientBestPost = async function(_ingredientId, _ingredientPostId) {
    appDebug.writeLine(appDebug.DebugType.Comment, "Set ingredient best post");

    try {
        //Only one post per ingredient can be the best post
        await database.collections.IngredientPost.updateMany(
            { ingredient_id: _ingredientId, is_best_post: true },
            { is_best_post: false }
        );
        await Promise.all([
            database.collections.Ingredient.findByIdAndUpdate(_ingredientId, { best_post_id: _ingredientPostId }),
            database.collections.IngredientPost.findByIdAndUpdate(_ingredientPostId, { is_best_post: true })
        ]);

        appDebug.writeLine(appDebug.DebugType.Comment, "Success set ingredient best post");
        return {
            "status": profileEnum.ProfileStatus_SetBestPost.Success
        };
    } catch (_err) {
        appDebug.writeLine(appDebug.DebugType.Exception, "Error : " + _err);
        return {
            "status" : profileEnum.ProfileStatus_SetBestPost.Exception,
            "detail" : _err
        };
    }
}

const createIngredientPost = async function(_postData)
{
    //*First, we try to create a ingredient post
    //If this user aready create post for this ingredient
    //We edit the current post
    let ingredient_id = _postData.ingredient_id;
    let ingredient_name = _postData.ingredient_name;
    let user_id = _postData.data.user_id
    let type = _postData.data.type;
    let short_detail = _postData.data.short_detail;
    let short_detail_vi = _postData.data.short_detail_vi || "";
    let profile_image = _postData.data.profile_image;
    let display_blocks = _postData.data.display_blocks;
    let unique_id = ingredient_id + "_" + user_id;

    //The folder name is built from this id, so it must be a plain database id
    if (!/^[a-f0-9]{24}$/i.test(String(ingredient_id))) {
        return {
            'status' : profileEnum.ProfileStatus_PostCreate.Exception,
            'status_code': profileEnum.Status_Code_Website.BadRequest,
            'detail' : "Invalid ingredient id"
        };
    }

    let ingredientPostData = {
        'name' : ingredient_name,
        'name_vi' : _postData.data.name_vi || "",
        'user_id' : user_id,
        'ingredient_id' : ingredient_id, 
        'unique_id' : unique_id,
        'date_time' : new Date().toJSON(),
        'points' : 0,
        'type' : type,
        'nutrition' : _postData.data.nutrition || null,
        'short_detail' : short_detail,
        'short_detail_vi' : short_detail_vi,
        'profile_image' : profile_image,
        'display_blocks' : display_blocks
    };

    
    try {
        //Find all temporary files and move it to ingredient folder
        let ingredientFolderPath = 'public/gallery/ingredients/' + ingredient_id + "/" + user_id + "/";
        let temporaryFolderPath = 'public/gallery/temporary/';
        
        let newIngredientPostData = await findFilePathsAndMoveAsync(
            ingredientPostData,
            path.join(__dirname, '../../'),
            temporaryFolderPath,
            ingredientFolderPath
        );

        try {
            appDebug.writeLine(appDebug.DebugType.Comment, "Creating ingredient post : " + unique_id);
            const _res = await database.collections.IngredientPost.create(newIngredientPostData);
            appDebug.writeLine(appDebug.DebugType.Comment, "Success create ingredient post");
            return {
                'status' : profileEnum.ProfileStatus_PostCreate.CreatingSuccess,
                'status_code': profileEnum.Status_Code_Website.Success,
                'detail' : "Success create ingredient post",
                'ingredient_post_id' : _res._id
            };
        } catch (_err) {
            //If this user aready create ingredient post for this ingredient
            //We edit the current ingredient post
            try {
                appDebug.writeLine(appDebug.DebugType.Exception, "Fail to create ingredient post");
                appDebug.writeLine(appDebug.DebugType.Comment, "Editing ingredient post : " + unique_id);
                const _res = await database.collections.IngredientPost.findOneAndUpdate(
                    { unique_id: unique_id },
                    newIngredientPostData,
                    { new: true }
                );
    
                appDebug.writeLine(appDebug.DebugType.Comment, "Success edit ingredient post");
                return {
                    'status' : profileEnum.ProfileStatus_PostCreate.EditingSuccess,
                    'status_code': profileEnum.Status_Code_Website.Success,
                    'detail' : "Success edit ingredient post",
                    'ingredient_post_id' : _res._id
                };
            } catch (_err) {
                appDebug.writeLine(appDebug.DebugType.Exception, "Error : " + _err);
                return {
                    'status' : profileEnum.ProfileStatus_PostCreate.Exception,
                    'status_code': profileEnum.Status_Code_Website.InternalServerError,
                    'detail' : _err
                };
            }
        }
    } catch (_err) {
        appDebug.writeLine(appDebug.DebugType.Exception, "Error: " + _err);
        return {
            'status' : profileEnum.ProfileStatus_PostCreate.Exception,
            'status_code': profileEnum.Status_Code_Website.InternalServerError,
            'detail' : _err
        }
    }
}
const createIngredient = async function(_postData){
    //*First, we convert name to right format : 
    //Only allow name contain letter
    //Begin letter is upcase and other is lower case
    //*Then, try to create Ingredient with this name
    //If aready exist, we return status existed
    let ingredient_name = (typeof _postData.name === 'string' ? _postData.name.trim() : '') ||
        (typeof _postData.name_vi === 'string' ? _postData.name_vi.trim() : '');
    let user_id = _postData.userid;
    let type = _postData.type;
    let short_detail = _postData.short_detail;
    let profile_image = _postData.profile_image;
    appDebug.writeLine(appDebug.DebugType.Comment, "Create ingredient : " + ingredient_name);
    if (/^[\p{L} _]+$/u.test(ingredient_name)){
        let ingredientData = {
            'name' : ingredient_name, 
            'name_vi' : _postData.name_vi || "",
            'best_post_id' : "",
            'is_need_update' : false
        };

        try {
            const _res = await database.collections.Ingredient.create(ingredientData);

            appDebug.writeLine(appDebug.DebugType.Comment, "Success create ingredient");
            let ingredient_id = _res._id;
            
            let ingrdientPostData = {
                'ingredient_id' : ingredient_id,
                'ingredient_name': ingredient_name,
                'data': {
                    'user_id' : user_id,
                    'name_vi' : _postData.name_vi || "",
                    'nutrition' : _postData.nutrition || null,
                    'type' : type,
                    'short_detail' : short_detail,
                    'short_detail_vi' : _postData.short_detail_vi || "",
                    'profile_image' : profile_image,
                    'display_blocks' : Array.isArray(_postData.display_blocks) ? _postData.display_blocks : []
                }
            }

            const _dataCreate = await createIngredientPost(ingrdientPostData);
            if (_dataCreate.status == profileEnum.ProfileStatus_PostCreate.CreatingSuccess) {
                // Set this ingredientPost is best post
                let ingredient_post_id = _dataCreate.ingredient_post_id;
                const _dataSet = await setIngredientBestPost(ingredient_id, ingredient_post_id);
                if (_dataSet.status == profileEnum.ProfileStatus_SetBestPost.Success) {
                    return {
                        "status" : profileEnum.ProfileStatus_Create.Success,
                        "status_code": profileEnum.Status_Code_Website.Success,
                        "ingredient_id" : ingredient_id,
                        "detail" : "Success create ingredient"
                    };
                } else {
                    return {
                        "status" : profileEnum.ProfileStatus_Create.Exception,
                        "status_code": profileEnum.Status_Code_Website.InternalServerError,
                        "detail" : _dataSet.detail
                    };
                }
            } else {
                appDebug.writeLine(appDebug.DebugType.Comment, _dataCreate.detail);
                return {
                    "status" : profileEnum.ProfileStatus_Create.Exception,
                    "status_code": profileEnum.Status_Code_Website.InternalServerError,
                    "detail" : _dataCreate.detail
                };
            }
        } catch (_err) {
            appDebug.writeLine(appDebug.DebugType.Exception, "Error : " + _err);
            return {
                "status" : profileEnum.ProfileStatus_Create.NameUsed,
                "status_code": profileEnum.Status_Code_Website.InternalServerError,
                "detail" : _err
            };
        }
    } else {
        appDebug.writeLine(appDebug.DebugType.Exception, "Ingredient name only allow letter and space");
        return {
            "status" : profileEnum.ProfileStatus_Create.NameFormatException,
            "status_code": profileEnum.Status_Code_Website.InternalServerError,
            "detail" : "Ingredient name only allow letter and space"
        };
    }
}

const getIngredientDetail = async function(_ingredientId)
{
    try {
        const _response = await database.collections.Ingredient.findById(_ingredientId, 'name name_vi nutrition best_post_id');

        return {
            'status' : profileEnum.ProfileStatus_Detail.Success, 
            'status_code': profileEnum.Status_Code_Website.Success,
            'data' : _response
        };
    } catch (_err) {
        return {
            'status' : profileEnum.ProfileStatus_Detail.Exception,
            'status_code': profileEnum.Status_Code_Website.InternalServerError,
            'detail' : _err
        };
    }
}
const getIngredientPostDetail = async function(_ingredientPostId)
{
    try {
        const _response = await database.collections.IngredientPost.findById(_ingredientPostId, 
        "name name_vi ingredient_id user_id is_best_post date_time points type nutrition short_detail short_detail_vi profile_image display_blocks");

        return {
            'status' : profileEnum.ProfileStatus_PostDetail.Success,
            'status_code': profileEnum.Status_Code_Website.Success,
            'data' : _response
        };
    } catch (_err) {
        return {
            'status': profileEnum.ProfileStatus_PostDetail.Exception,
            'status_code': profileEnum.Status_Code_Website.InternalServerError,
            'detail': _err
        };
    }
}

router.get('/mine', verifyToken, async function(req, res){
    try {
        const posts = await database.collections.IngredientPost.find({ user_id: req.body.userid })
            .sort({ date_time: -1 })
            .limit(50);

        res.status(200).send({
            'status' : profileEnum.ProfileStatus_Detail.Success,
            'status_code': profileEnum.Status_Code_Website.Success,
            'data' : posts.map(post => ({
                'id' : post._id,
                'name' : post.name,
                'name_vi' : post.name_vi || null,
                'type' : post.type,
                'short_detail' : post.short_detail,
                'profile_image' : post.profile_image,
                'is_best_post' : !!post.is_best_post,
                'date_time' : post.date_time,
            }))
        });
    } catch (_err) {
        appDebug.writeLine(appDebug.DebugType.Exception, "Error listing own ingredient posts : " + _err);
        res.status(500).send({
            'status' : profileEnum.ProfileStatus_Detail.Exception,
            'status_code': profileEnum.Status_Code_Website.InternalServerError,
            'detail' : _err.toString()
        });
    }
});
router.post('/create_ingredient', verifyToken, async function(req, res){
    const result = await createIngredient(req.body);
    if (result.status === profileEnum.ProfileStatus_Create.Success) {
        const detail = (typeof req.body.name === 'string' ? req.body.name.trim() : '')
            || (typeof req.body.name_vi === 'string' ? req.body.name_vi.trim() : '');
        await auditContent(req, 'ingredient.create', 'ingredient', result.ingredient_id, detail);
    }
    res.status(result.status_code).send(result);
});
router.post('/create_ingredient_post', verifyToken, async function(req, res){
    if (!req.body.data) {
        return res.status(400).send({
            'status' : profileEnum.ProfileStatus_PostCreate.Exception,
            'status_code': profileEnum.Status_Code_Website.BadRequest,
            'detail' : "Missing post data"
        });
    }
    //Never trust the user id from the client
    req.body.data.user_id = req.body.userid;
    const result = await createIngredientPost(req.body);
    const created = result.status === profileEnum.ProfileStatus_PostCreate.CreatingSuccess
        || result.status === profileEnum.ProfileStatus_PostCreate.EditingSuccess;
    if (created && result.ingredient_post_id) {
        const detail = req.body.ingredient_name || req.body.data.name || '';
        await auditContent(req, 'ingredient_post.create', 'ingredient_post', result.ingredient_post_id, detail);
    }
    res.status(result.status_code).send(result);
});
router.get('/get_ingredient/:ingredient_id', async function(req, res){
    const result = await getIngredientDetail(req.params.ingredient_id);
    res.status(result.status_code).send(result);
});
router.get('/get_ingredient_post/:ingredient_post_id', async function(req, res){
    const result = await getIngredientPostDetail(req.params.ingredient_post_id);
    res.status(result.status_code).send(result);
});

//export this router to use in our index.js
module.exports = router;