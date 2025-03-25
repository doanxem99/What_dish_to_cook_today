const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/what_dish_to_cook_today?directConnection=true');

//*Create collection
const Ingredient = mongoose.model('ingredient', { 
    name: {
        type: String,
        unique: true // `name` must be unique
    },
    best_post_id : String,
    is_need_update: Boolean
},'ingredient');
const IngredientPost = mongoose.model('ingredient_post', { 
    ingredient_id : String,
    user_id : String,
    unique_id : {
        type: String,
        unique: true // `unique_id` must be unique
    },
    is_best_post : {
        type : Boolean,
        default : false
    },
    date_time : Date,
    point: Number,
    type: String,
    short_detail: String,
    profile_image : String,
    display_blocks : Array
},'ingredient_post');
const Dish = mongoose.model('dish', { 
    name: {
        type: String,
        unique: true // `name` must be unique
    },
    best_post_id : String,
    is_need_update: Boolean
},'dish');
const DishPost = mongoose.model('dish_post', { 
    dish_id : String,
    user_id : String,
    unique_id : {
        type: String,
        unique: true // `unique_id` must be unique
    },
    is_best_post : {
        type : Boolean,
        default : false
    },
    date_time : Date,
    point: Number,
    ingredients : Array,
    type: String,
    short_detail: String,
    profile_image : String,
    display_blocks : Array
},'dish_post');
const DatabaseWorkerJob = mongoose.model('database_worker_job', {
    data: String,
    time_request : String,
},'database_worker_job');

module.exports = {
    "mongoose" : mongoose,
    "collections" : {
        Ingredient,
        IngredientPost,
        Dish,
        DishPost,
        DatabaseWorkerJob
    }
};