const mongoose = require('mongoose');
mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/what_dish_to_cook_today?directConnection=true', {
        //Fail fast instead of buffering requests forever when the database is down
        serverSelectionTimeoutMS: 5000
    })
    .then(() => {
        console.log('MongoDB connected!');
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });
//*Create collection
const Role = mongoose.model('role', {
    name: {
        type: String,
        unique: true // `name` must be unique
    },
    description: String
},'role');

const User = mongoose.model('user', { 
    username: {
        type: String,
        unique: true, // `name` must be unique
        required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true, // `name` must be unique
        required: true
    },
    roles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'role',
        required: true
    }],
    created_at: {
        type: Date
    },
    profile_image: {
        type: Buffer
    }
},'user'); 

const Ingredient = mongoose.model('ingredient', { 
    name: {
        type: String,
        unique: true // `name` must be unique
    },
    name_vi: String,
    best_post_id : String,
    is_need_update: Boolean
},'ingredient');

const IngredientPost = mongoose.model('ingredient_post', { 
    name : String,
    name_vi : String,
    user_id : String,
    ingredient_id : String,
    is_best_post : {
        type: Boolean,
        default: false
    },
    date_time : Date,
    unique_id : {
        type: String,
        unique: true
    },
    points: Number,
    type: String,
    short_detail: String,
    short_detail_vi: String,
    profile_image : String,
    display_blocks : Array
},'ingredient_post');

const Dish = mongoose.model('dish', { 
    name: {
        type: String,
        unique: true // `name` must be unique
    },
    name_vi: String,
    best_post_id : String,
    is_need_update: Boolean,
},'dish');
const DishPost = mongoose.model('dish_post', { 
    name : String,
    name_vi : String,
    user_id : String,
    dish_id : String,
    is_best_post : {
        type: Boolean,
        default: false
    },
    date_time : Date,
    unique_id : {
        type: String,
        unique: true
    },
    points: Number,
    views: Number,
    comments: Number,
    ingredients : Array,
    // type: String,
    short_detail: String,
    short_detail_vi: String,
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
        Role,
        User,
        Ingredient,
        IngredientPost,
        Dish,
        DishPost,
        DatabaseWorkerJob
    }
};