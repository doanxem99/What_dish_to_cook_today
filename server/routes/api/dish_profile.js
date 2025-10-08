const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const fileAction = require('../../config/file/file_action');
const templateImage = require('../../config/template/template_image');
const path = require('path');
const workerCenter = require('../../config/worker/worker_center');
const appDebug = require('../../config/debug/app_debug');
const profileEnum = require('../../config/enum/profile_enum');
const { verifyToken } = require('./verifyToken');

// Convert callback-based file operations to Promise
const findFilePathsAndMoveAsync = (dishPostData, rootPath, tempFolder, dishFolder) => {
    return new Promise((resolve, reject) => {
        fileAction.findFilePathsAndMove(dishPostData, rootPath, tempFolder, dishFolder, (newData) => {
            resolve(newData);
        });
    });
};

// Rewritten with async/await
const setDishBestPost = async function(_dishId, _dishPostId) {
    appDebug.writeLine(appDebug.DebugType.Comment, "Set dish best post");
    
    try {
        // Run both updates in parallel with Promise.all
        await Promise.all([
            database.collections.Dish.findByIdAndUpdate(_dishId, { best_post_id: _dishPostId }),
            database.collections.DishPost.findByIdAndUpdate(_dishPostId, { is_best_post: true })
        ]);
        
        appDebug.writeLine(appDebug.DebugType.Comment, "Success set dish best post");
        return {
            "status": profileEnum.ProfileStatus_SetBestPost.Success
        };
    } catch (err) {
        appDebug.writeLine(appDebug.DebugType.Exception, "Error: " + err);
        return {
            "status": profileEnum.ProfileStatus_SetBestPost.Exception,
            "detail": err
        };
    }
};

// Rewritten with async/await
const createDishPost = async function(_postData) {
    // First, we try to create a dish post
    // If this user already created a post for this dish
    // We edit the current post
    let dish_id = _postData.dish_id;
    let user_id = _postData.data.user_id;
    let dish_name = _postData.data.name;
    let ingredients = _postData.data.ingredients;
    let short_detail = _postData.data.short_detail;
    let profile_image = _postData.data.profile_image;
    let display_blocks = _postData.data.display_blocks;
    let unique_id = dish_id + "_" + user_id;

    let dishPostData = {
        'name': dish_name,
        'user_id': user_id,
        'dish_id': dish_id,
        'unique_id': unique_id,
        'date_time': new Date().toJSON(),
        'points': 0,
        'ingredients': ingredients,
        'short_detail': short_detail,
        'profile_image': profile_image,
        'display_blocks': display_blocks
    };

    appDebug.writeLine(appDebug.DebugType.Comment, "Create dish post: " + dish_name);
    
    try {
        // Move files from temporary to dish folder
        let dishFolderPath = 'public/gallery/dishs/' + dish_id + "/" + user_id + "/";
        let temporaryFolderPath = 'public/gallery/temporary/';
        let newDishPostData = await findFilePathsAndMoveAsync(
            dishPostData, 
            path.join(__dirname, '../../'), 
            temporaryFolderPath, 
            dishFolderPath
        );

        newDishPostData.unique_id = unique_id;
        
        // Try to create a dish post
        try {
            const res = await database.collections.DishPost.create(newDishPostData);
            appDebug.writeLine(appDebug.DebugType.Comment, "Success create dish post");
            return {
                'status': profileEnum.ProfileStatus_PostCreate.CreatingSuccess,
                'detail': "Success create dish post",
                'dish_post_id': res._id
            };
        } catch (err) {
            // Try to update instead
            try {
                const res = await database.collections.DishPost.updateOne(
                    { unique_id: unique_id }, 
                    newDishPostData
                );
                appDebug.writeLine(appDebug.DebugType.Comment, "Success edit dish post");
                return {
                    'status': profileEnum.ProfileStatus_PostCreate.EditingSuccess,
                    'detail': "Success edit dish post",
                    'dish_post_id': res._id
                };
            } catch (updateErr) {
                appDebug.writeLine(appDebug.DebugType.Exception, updateErr);
                return {
                    'status': profileEnum.ProfileStatus_PostCreate.Exception,
                    'detail': updateErr
                };
            }
        }
    } catch (err) {
        appDebug.writeLine(appDebug.DebugType.Exception, err);
        return {
            'status': profileEnum.ProfileStatus_PostCreate.Exception,
            'detail': err
        };
    }
};

// Rewritten with async/await
const createDish = async function(_postData) {
    // First, we convert name to right format:
    // Only allow name contain letter
    // Begin letter is upcase and other is lower case
    // Then, try to create Dish with this name
    // If already exists, we return status existed
    console.log("Create dish with data: ", _postData);
    let dishName = _postData.name;
    let user_id = _postData.userid;
    let ingredients = _postData.ingredients;
    let short_detail = _postData.short_detail;
    let profile_image = _postData.profile_image;
    let display_blocks = _postData.display_blocks;
    
    appDebug.writeLine(appDebug.DebugType.Comment, "Create dish: " + dishName);
    
    if (!/^[A-Za-z _]+$/.test(dishName)) {
        appDebug.writeLine(appDebug.DebugType.Exception, "Dish name only allow letter and space");
        return {
            "status": profileEnum.ProfileStatus_Create.NameFormatException,
            "detail": "Dish name only allow letter and space"
        };
    }
    
    let dishData = {
        'name': dishName,
        'best_post_id': "",
        'is_need_update': false
    };

    try {
        // Create the dish
        const dish = await database.collections.Dish.create(dishData);
        appDebug.writeLine(appDebug.DebugType.Comment, "Success create dish");
        
        // Add dish post data
        const dishId = dish._id;
        const ingredientPostData = {
            'dish_id': dishId,
            'data': {
                'name': dishName,
                'user_id': user_id,
                'ingredients': ingredients,
                'short_detail': short_detail,
                'profile_image': profile_image,
                'display_blocks': display_blocks
            }
        };
        
        // Create dish post
        const dishPostResult = await createDishPost(ingredientPostData);
        
        if (dishPostResult.status === profileEnum.ProfileStatus_PostCreate.CreatingSuccess) {
            // Set this dishPost as best post
            const dishPostId = dishPostResult.dish_post_id;
            const bestPostResult = await setDishBestPost(dishId, dishPostId);
            
            if (bestPostResult.status === profileEnum.ProfileStatus_SetBestPost.Success) {
                return {
                    "status": profileEnum.ProfileStatus_Create.Success,
                    "dish_id": dishId,
                    "detail": "Success create dish"
                };
            } else {
                return {
                    "status": profileEnum.ProfileStatus_Create.Exception,
                    "detail": bestPostResult.detail
                };
            }
        } else {
            appDebug.writeLine(appDebug.DebugType.Comment, dishPostResult.detail);
            return {
                "status": profileEnum.ProfileStatus_Create.Exception,
                "detail": dishPostResult.detail
            };
        }
    } catch (err) {
        appDebug.writeLine(appDebug.DebugType.Exception, err);
        return {
            "status": profileEnum.ProfileStatus_Create.NameUsed,
            "detail": err
        };
    }
};

// Rewritten with async/await
const getDishDetail = async function(_dishId) {
    try {
        const response = await database.collections.Dish.findById(_dishId, 'name best_post_id');
        return {
            'status': profileEnum.ProfileStatus_Detail.Success,
            'data': response
        };
    } catch (err) {
        return {
            'status': profileEnum.ProfileStatus_Detail.Exception,
            'detail': err
        };
    }
};

// Rewritten with async/await
const getDishPostDetail = async function(_dishPostId) {
    try {
        const response = await database.collections.DishPost.findById(
            _dishPostId,
            "name dish_id user_id is_best_post date_time points ingredients short_detail profile_image display_blocks"
        );

        // Update views count
        await database.collections.DishPost.updateOne(
            { _id: _dishPostId },
            { $inc: { views: 1 } }
        );

        return {
            'status': profileEnum.ProfileStatus_PostDetail.Success,
            'data': response
        };
    } catch (err) {
        return {
            'status': profileEnum.ProfileStatus_PostDetail.Exception,
            'detail': err
        };
    }
};

const getBestDishPost = async function() {
    try {
        // Find the best dish post based on the maximum points in the DishPost collection
        const dishPost = await database.collections.DishPost.findOne(
            { is_best_post: true },
            "name dish_id user_id is_best_post date_time points views comments ingredients short_detail profile_image display_blocks"
        ).sort({ points: -1 });

        const user = await database.collections.User.findById(
            dishPost.user_id,
            "username"
        );

        const ingredients = await database.collections.Ingredient.find(
            { _id: dishPost.ingredients },
            "name"
        );

        const responseData = dishPost ? dishPost.toObject() : null;

        // Add username to the response
        responseData.username = user ? user.username : "Unknown User";
        // Add ingredient name to each ingredient in the dish post
        let index = 0;
        responseData.ingredients = responseData.ingredients.map(ingredient => {
            return {
                'ingredient_id': ingredient,
                'name': ingredients[index++].name,
            };
        });

        return {
            'status': profileEnum.ProfileStatus_PostDetail.Success,
            'data': responseData
        };
    } catch (err) {
        console.log("Error when get best dish post: ", err);
        return {
            'status': profileEnum.ProfileStatus_PostDetail.Exception,
            'detail': err
        }
    }
}

// Route handlers with async/await
// Post request to create a dish with verification token
router.post('/create_dish', verifyToken, async function(req, res) {
    const result = await createDish(req.body);
    res.status(200).send(result);
});

router.post('/create_dish_post', async function(req, res) {
    const result = await createDishPost(req.body);
    res.status(200).send(result);
});

router.get('/get_dish/:dish_id', async function(req, res) {
    const result = await getDishDetail(req.params.dish_id);
    res.status(200).send(result);
});

router.get('/get_dish_post/:dish_post_id', async function(req, res) {
    const result = await getDishPostDetail(req.params.dish_post_id);
    res.status(200).send(result);
});

router.get('/get_dish_posts/:dish_ids', async function(req, res) {
    const result = await getDishPostIds(req.params.dish_ids);
    res.status(200).send(result);
});

router.get('/get_best_dish_post', async function(req, res) {
    const result = await getBestDishPost();
    res.status(200).send(result);
})

// export this router to use in our index.js
module.exports = router;
