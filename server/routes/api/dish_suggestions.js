//History-aware pantry suggestions: a deterministic score over the catalog, no model call.
//candidates = dishes whose best post uses at least one pantry ingredient.
const express = require('express');
const router = express.Router();
const { mongoose, collections } = require('../../config/database/connection');
const { verifyToken } = require('./verifyToken');

const HEX_ID = /^[0-9a-f]{24}$/i;
const HISTORY_DAYS = 90;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

const parseIds = function(value) {
    return String(value || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
};

const parseLimit = function(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
    return Math.min(MAX_LIMIT, Math.max(1, parsed));
};

//A session user is an ObjectId; a legacy or client id is a plain string.
const userKeys = function(userId) {
    const keys = [String(userId)];
    if (HEX_ID.test(String(userId))) keys.push(new mongoose.Types.ObjectId(String(userId)));
    return keys;
};

const findSuggestions = async function({ userId, pantryIds, limit }) {
    if (pantryIds.length === 0) return [];

    const since = new Date(Date.now() - HISTORY_DAYS * 86400 * 1000);
    const posts = await collections.DishPost.find(
        { is_best_post: true, ingredients: { $in: pantryIds } },
        'dish_id ingredients profile_image servings points'
    );
    if (posts.length === 0) return [];

    const dishIds = [...new Set(posts.map(post => post.dish_id).filter(Boolean))];
    const dishes = await collections.Dish.find({ _id: { $in: dishIds } }, 'name name_vi');
    const dishById = new Map(dishes.map(dish => [String(dish._id), dish]));

    const selected = new Set(pantryIds);
    const byDish = new Map();
    for (const post of posts) {
        const dish = dishById.get(String(post.dish_id));
        if (!dish) continue;
        const ingredientIds = (post.ingredients || []).map(String);
        const candidate = {
            dish_id: String(dish._id),
            name: dish.name,
            name_vi: dish.name_vi || null,
            image: post.profile_image || null,
            servings: post.servings || null,
            points: Number(post.points) || 0,
            ingredient_ids: ingredientIds,
            match_count: ingredientIds.filter(id => selected.has(id)).length
        };
        //A dish can carry more than one best post; keep the one that covers more of the pantry.
        const current = byDish.get(candidate.dish_id);
        if (!current || candidate.match_count > current.match_count ||
            (candidate.match_count === current.match_count && candidate.points > current.points)) {
            byDish.set(candidate.dish_id, candidate);
        }
    }
    const candidates = [...byDish.values()];

    const events = await collections.UserEvent.collection.find({
        user_id: { $in: userKeys(userId) },
        type: { $in: ['dish_cooked', 'ingredient_picked'] },
        created_at: { $gte: since }
    }).toArray();
    const cookedDishIds = new Set(events.filter(row => row.type === 'dish_cooked').map(row => String(row.target_id)));
    const pickedIngredientIds = new Set(events.filter(row => row.type === 'ingredient_picked').map(row => String(row.target_id)));

    //The popular reason marks the top third of the candidate points, never a zero-point dish.
    const sortedPoints = candidates.map(candidate => candidate.points).sort((a, b) => b - a);
    const popularCutoff = sortedPoints[Math.max(0, Math.ceil(candidates.length / 3) - 1)];

    const rows = candidates.map((candidate) => {
        const cooked = cookedDishIds.has(candidate.dish_id);
        const picked = candidate.ingredient_ids.some(id => pickedIngredientIds.has(id));
        const reasons = [];
        if (candidate.match_count > 0) reasons.push('matches_pantry');
        if (cooked) reasons.push('cooked_before');
        if (picked) reasons.push('picked_before');
        if (candidate.points > 0 && candidate.points >= popularCutoff) reasons.push('popular');

        const score = candidate.match_count * 2 + (cooked ? 3 : 0) + (picked ? 1 : 0) + 0.1 * candidate.points;
        return {
            dish_id: candidate.dish_id,
            name: candidate.name,
            name_vi: candidate.name_vi,
            image: candidate.image,
            servings: candidate.servings,
            score: Math.round(score * 10) / 10,
            reasons,
            _points: candidate.points
        };
    });

    rows.sort((a, b) => b.score - a.score ||
        b._points - a._points ||
        String(a.name || '').localeCompare(String(b.name || '')) ||
        a.dish_id.localeCompare(b.dish_id));

    return rows.slice(0, limit).map(({ _points, ...row }) => row);
};

router.get('/', verifyToken, async function(req, res) {
    try {
        const pantryIds = parseIds(req.query.ingredients);
        if (pantryIds.some(id => !HEX_ID.test(id))) {
            return res.status(400).send({ rows: [], error: 'invalid_ingredient_id' });
        }
        const rows = await findSuggestions({
            userId: req.body.userid,
            pantryIds,
            limit: parseLimit(req.query.limit)
        });
        res.status(200).send({ rows });
    } catch (err) {
        res.status(500).send({ rows: [], status: err.toString() });
    }
});

module.exports = router;
