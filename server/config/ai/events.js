//Personal cooking history. One row per user, type, target and UTC day; 90-day TTL.
//The recorder accepts either a dish id or a dish post id, so a page opened by post id
//still stores the parent dish.
const { mongoose, collections } = require('../database/connection');

const EVENT_TYPES = ['dish_viewed', 'dish_cooked', 'ingredient_picked', 'chat_message'];
const EVENT_TTL_DAYS = 90;
const TARGET_TYPES = {
    dish_viewed: 'dish',
    dish_cooked: 'dish',
    ingredient_picked: 'ingredient',
    chat_message: 'chat'
};
const SIGNAL_WEIGHTS = { dish_cooked: 3, ingredient_picked: 2, dish_viewed: 1 };
const SIGNAL_REASONS = { dish_cooked: 'cooked', ingredient_picked: 'picked', dish_viewed: 'viewed' };

const HEX_ID = /^[0-9a-f]{24}$/i;

//Real users pass an ObjectId; tests and the Flutter recorder may pass a plain id string.
const userKey = (userId) => (HEX_ID.test(String(userId)) ? new mongoose.Types.ObjectId(String(userId)) : String(userId));

const dayOf = (date) => new Date(date).toISOString().slice(0, 10);

const expiresAt = (now) => new Date(now.getTime() + EVENT_TTL_DAYS * 86400 * 1000);

const resolveDishId = async (targetId, dishPostId) => {
    const candidates = [dishPostId, targetId]
        .map(value => String(value || ''))
        .filter(value => HEX_ID.test(value));
    //A post id wins: dish_cooked always stores the parent dish.
    for (const id of candidates) {
        const post = await collections.DishPost.findById(id, 'dish_id');
        if (post && post.dish_id) return String(post.dish_id);
    }
    for (const id of candidates) {
        const dish = await collections.Dish.findById(id, '_id');
        if (dish) return String(dish._id);
    }
    return null;
};

const recordUserEvent = async ({ userId, type, targetId, dishPostId, now = new Date() }) => {
    if (!EVENT_TYPES.includes(type)) {
        throw new Error(`Unknown user event type ${type}`);
    }
    if (!userId) {
        throw new Error('A user event needs a user id');
    }
    const targetType = TARGET_TYPES[type];
    let resolvedId = targetId == null ? '' : String(targetId);
    if (type === 'dish_viewed' || type === 'dish_cooked') {
        const dishId = await resolveDishId(targetId, dishPostId);
        if (!dishId) return null;
        resolvedId = dishId;
    } else if (type === 'ingredient_picked') {
        if (!resolvedId) return null;
        const ingredient = HEX_ID.test(resolvedId)
            ? await collections.Ingredient.findById(resolvedId, '_id')
            : null;
        if (!ingredient) return null;
    } else if (!resolvedId) {
        //One chat row per day is enough; the user id keeps the key non-empty.
        resolvedId = String(userId);
    }

    const day = dayOf(now);
    const filter = { user_id: userKey(userId), type, target_id: resolvedId, day };
    const update = {
        $set: { created_at: now, expires_at: expiresAt(now) },
        $setOnInsert: { target_type: targetType }
    };
    //Raw collection: the schema types user_id as ObjectId, but a string recorder id must work too.
    const collection = collections.UserEvent.collection;
    try {
        const result = await collection.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' });
        return result && (result.value || result);
    } catch (error) {
        if (error && error.code === 11000) {
            //Two writes raced the same day: read the row that won.
            return collection.findOne(filter);
        }
        throw error;
    }
};

const listUserEvents = async (userId, { page = 1, pageSize = 25 } = {}) => {
    const currentPage = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const filter = { user_id: userKey(userId) };
    const collection = collections.UserEvent.collection;
    const [total, docs] = await Promise.all([
        collection.countDocuments(filter),
        collection.find(filter)
            .sort({ created_at: -1 })
            .skip((currentPage - 1) * size)
            .limit(size)
            .toArray()
    ]);

    const dishIds = docs.filter(row => row.target_type === 'dish').map(row => row.target_id);
    const ingredientIds = docs.filter(row => row.target_type === 'ingredient').map(row => row.target_id);
    const [dishes, ingredients] = await Promise.all([
        dishIds.length > 0 ? collections.Dish.find({ _id: { $in: dishIds } }, 'name name_vi') : [],
        ingredientIds.length > 0 ? collections.Ingredient.find({ _id: { $in: ingredientIds } }, 'name name_vi') : []
    ]);
    const dishNames = new Map(dishes.map(row => [String(row._id), row]));
    const ingredientNames = new Map(ingredients.map(row => [String(row._id), row]));

    const rows = docs.map((row) => {
        const source = row.target_type === 'dish'
            ? dishNames.get(String(row.target_id))
            : row.target_type === 'ingredient'
                ? ingredientNames.get(String(row.target_id))
                : null;
        return {
            id: String(row._id),
            type: row.type,
            target_type: row.target_type,
            target_id: String(row.target_id || ''),
            target_name: source ? source.name : null,
            target_name_vi: source ? source.name_vi : null,
            created_at: row.created_at
        };
    });
    return { rows, total, page: currentPage };
};

const clearUserEvents = async (userId) => {
    const result = await collections.UserEvent.collection.deleteMany({ user_id: userKey(userId) });
    return result.deletedCount || 0;
};

const addBoost = (boosts, dishId, score, reason) => {
    if (!dishId) return;
    const key = String(dishId);
    const entry = boosts.get(key) || { score: 0, reasons: [] };
    entry.score += score;
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    boosts.set(key, entry);
};

//Explicit signals (votes, comments, own posts) plus implicit weights
//(cooked 3, picked 2, viewed 1). Picked ingredients lift the dishes that use them.
const loadUserSignals = async (userId) => {
    const dishBoosts = new Map();
    const likedIngredientIds = new Set();
    const events = await collections.UserEvent.collection.find({ user_id: userKey(userId) })
        .sort({ created_at: -1 })
        .limit(500)
        .toArray();

    for (const event of events) {
        if (event.type === 'ingredient_picked') {
            likedIngredientIds.add(String(event.target_id));
            continue;
        }
        const weight = SIGNAL_WEIGHTS[event.type];
        if (weight) addBoost(dishBoosts, event.target_id, weight, SIGNAL_REASONS[event.type]);
    }

    const picked = [...likedIngredientIds];
    if (picked.length > 0) {
        const posts = await collections.DishPost.find({
            is_best_post: true,
            ingredients: { $in: picked }
        }, 'dish_id ingredients');
        for (const post of posts) {
            const matched = (post.ingredients || []).filter(id => likedIngredientIds.has(String(id))).length;
            if (matched > 0) addBoost(dishBoosts, post.dish_id, 2 * matched, 'picked ingredient');
        }
    }

    const authorKey = String(userId);
    const [votes, comments, ownPosts] = await Promise.all([
        collections.Vote.find({ user_id: authorKey }, 'dish_post_id'),
        collections.Comment.find({ user_id: authorKey }, 'dish_post_id'),
        collections.DishPost.find({ user_id: authorKey }, 'dish_id')
    ]);
    const votedPostIds = votes.map(row => String(row.dish_post_id)).filter(Boolean);
    const commentedPostIds = comments.map(row => String(row.dish_post_id)).filter(Boolean);
    const postIds = [...new Set(votedPostIds.concat(commentedPostIds))];
    if (postIds.length > 0) {
        const posts = await collections.DishPost.find({ _id: { $in: postIds } }, 'dish_id');
        const dishByPost = new Map(posts.map(post => [String(post._id), post.dish_id]));
        for (const postId of votedPostIds) {
            addBoost(dishBoosts, dishByPost.get(postId), 1, 'voted');
        }
        for (const postId of commentedPostIds) {
            addBoost(dishBoosts, dishByPost.get(postId), 1, 'commented');
        }
    }
    for (const post of ownPosts) {
        addBoost(dishBoosts, post.dish_id, 1, 'your post');
    }

    return { dishBoosts, likedIngredientIds };
};

module.exports = {
    EVENT_TYPES,
    recordUserEvent,
    listUserEvents,
    clearUserEvents,
    loadUserSignals
};
