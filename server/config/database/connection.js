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

//Roles the server needs; created on boot when missing
const default_roles = [
    { name: 'user', description: 'User role' },
    { name: 'admin', description: 'Admin role' }
];

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
    background_image: String,
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
    },
    is_disabled: {
        type: Boolean,
        default: false
    },
    must_change_password: {
        type: Boolean,
        default: false
    },
    //AI assistant: per-user kill switch, quota override and tool capability
    ai_disabled: {
        type: Boolean,
        default: false
    },
    ai_daily_limit: {
        type: Number,
        default: null
    },
    ai_capability: {
        type: String,
        enum: ['read_only', 'prepare', 'act_freely'],
        default: 'read_only'
    }
},'user'); 

const Ingredient = mongoose.model('ingredient', { 
    name: {
        type: String,
        unique: true // `name` must be unique
    },
    name_vi: String,
    best_post_id : String,
    nutrition : Object,
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
    nutrition : Object,
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
    images : Array,
    servings : Number,
    nutrition : Object,
    ingredient_amounts : Array,
    display_blocks : Array
},'dish_post');

const Comment = mongoose.model('comment', {
    dish_post_id : String,
    user_id : String,
    body : String,
    date_time : Date,
},'comment');

const Vote = mongoose.model('vote', {
    user_id : String,
    dish_post_id : String,
    date_time : Date,
},'vote');
//One vote per user and post
Vote.schema.index({ user_id: 1, dish_post_id: 1 }, { unique: true });

//Immutable admin actions. No update or delete path exists in code.
const AuditLog = mongoose.model('audit_log', {
    actor_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    actor_name : String,
    action : String,
    target_type : String,
    target_id : String,
    result : String,
    detail : String,
    ip : String,
    created_at : Date
},'audit_log');
AuditLog.schema.index({ created_at: 1 });
AuditLog.schema.index({ action: 1 });

//Queued admin work. The runner claims one row at a time.
const AdminJob = mongoose.model('admin_job', {
    type : String,
    status : {
        type: String,
        enum: ['queued', 'running', 'done', 'failed'],
        default: 'queued'
    },
    actor_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    actor_name : String,
    payload : Object,
    detail : String,
    error : String,
    created_at : Date,
    started_at : Date,
    finished_at : Date,
    //Reserved for AI jobs: metrics only, never prompt or response text
    provider : String,
    model : String,
    latency_ms : Number,
    tokens_in : Number,
    tokens_out : Number,
    cost_estimate : Number
},'admin_job');
AdminJob.schema.index({ status: 1, created_at: 1 });

//Locally embedded passages. The hash keeps an unchanged row out of the embedder.
const AiEmbedding = mongoose.model('ai_embedding', {
    target_type : String,
    target_id : String,
    locale : String,
    source_hash : String,
    text : String,
    vector : [Number],
    model : String,
    updated_at : Date
},'ai_embedding');
AiEmbedding.schema.index({ target_type: 1, target_id: 1, locale: 1, model: 1 }, { unique: true });

//One rolling transcript per user, capped at 20 messages and dropped after 30 days.
const AiConversation = mongoose.model('ai_conversation', {
    user_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        unique: true
    },
    session_id : String,
    messages : [{
        role : String,
        content : String,
        mode : String,
        citations : Array,
        tool_summary : Object,
        stopped : Boolean,
        created_at : Date
    }],
    updated_at : Date,
    expires_at : Date
},'ai_conversation');
AiConversation.schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

//Per-call metrics only. No prompt, reply or retrieved text.
const AiCall = mongoose.model('ai_call', {
    user_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    conversation_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ai_conversation'
    },
    provider : String,
    model : String,
    mode : String,
    capability : String,
    latency_ms : Number,
    tokens_in : Number,
    tokens_out : Number,
    cost_estimate : Number,
    status : String,
    error_code : String,
    created_at : Date
},'ai_call');
AiCall.schema.index({ user_id: 1, status: 1, created_at: -1 });
AiCall.schema.index({ created_at: -1 });

//Personal cooking history: one row per user, type, target and UTC day.
const UserEvent = mongoose.model('user_event', {
    //Mixed: the recorder accepts an ObjectId from a session and a plain string id from a client.
    user_id : mongoose.Schema.Types.Mixed,
    type : String,
    target_type : String,
    target_id : String,
    day : String,
    created_at : Date,
    expires_at : Date
},'user_event');
UserEvent.schema.index({ user_id: 1, type: 1, target_id: 1, day: 1 }, { unique: true });
UserEvent.schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const Setting = mongoose.model('setting', {
    key : {
        type: String,
        unique: true
    },
    enabled : Boolean,
    reason : String,
    actor_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    actor_name : String,
    //The job that switched maintenance on; only it may switch the flag off
    owner_job_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin_job'
    },
    updated_at : Date
},'settings');

module.exports = {
    "mongoose" : mongoose,
    "default_roles" : default_roles,
    "collections" : {
        Role,
        User,
        Ingredient,
        IngredientPost,
        Dish,
        DishPost,
        Comment,
        Vote,
        AuditLog,
        AdminJob,
        AiEmbedding,
        AiConversation,
        AiCall,
        UserEvent,
        Setting
    }
};