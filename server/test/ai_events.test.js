const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let collections;
let events;

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('ai_events_test');
    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;
    events = require('../config/ai/events');
});

after(async () => {
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) await mongod.stop();
});

beforeEach(async () => {
    await Promise.all([
        collections.UserEvent.deleteMany({}),
        collections.Dish.deleteMany({}),
        collections.DishPost.deleteMany({}),
        collections.Ingredient.deleteMany({}),
        collections.Vote.deleteMany({}),
        collections.Comment.deleteMany({})
    ]);
});

test('recordUserEvent dedupes per user, type, target per UTC day and sets 90-day TTL', async () => {
    const dish = await collections.Dish.create({ name: 'Fried Rice', name_vi: 'Cơm chiên' });
    const post = await collections.DishPost.create({
        dish_id: String(dish._id),
        user_id: 'u1',
        unique_id: `${dish._id}_u1`,
        is_best_post: true,
        name: 'Fried Rice'
    });
    const day1Morning = new Date('2026-11-19T08:00:00Z');
    const day1Evening = new Date('2026-11-19T21:00:00Z');

    // Opening by post id resolves to the parent dish id
    await events.recordUserEvent({ userId: 'u1', type: 'dish_cooked', targetId: String(post._id), now: day1Morning });
    await events.recordUserEvent({ userId: 'u1', type: 'dish_cooked', targetId: String(dish._id), now: day1Evening });

    const rows = await collections.UserEvent.find({ user_id: 'u1' });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].target_id, String(dish._id));
    const ttlDays = Math.round((rows[0].expires_at - day1Evening) / (86400 * 1000));
    assert.strictEqual(ttlDays, 90);

    // A later UTC day is a separate row
    await events.recordUserEvent({
        userId: 'u1', type: 'dish_cooked', targetId: String(dish._id),
        now: new Date('2026-11-20T08:00:00Z')
    });
    assert.strictEqual(await collections.UserEvent.countDocuments({ user_id: 'u1', type: 'dish_cooked' }), 2);
});

test('listUserEvents hydrates names and clearUserEvents removes all rows', async () => {
    const dish = await collections.Dish.create({ name: 'Pho Bo', name_vi: 'Phở bò' });
    await events.recordUserEvent({ userId: 'u1', type: 'dish_viewed', targetId: String(dish._id) });

    const page = await events.listUserEvents('u1', { page: 1 });
    assert.strictEqual(page.total, 1);
    assert.strictEqual(page.rows[0].target_name, 'Pho Bo');
    assert.strictEqual(page.rows[0].target_name_vi, 'Phở bò');

    await events.clearUserEvents('u1');
    assert.strictEqual((await events.listUserEvents('u1')).total, 0);
});

test('loadUserSignals weights cooked (3), picked (2), viewed (1) and votes', async () => {
    const ing = await collections.Ingredient.create({ name: 'Beef', name_vi: 'Thịt bò' });
    const dish = await collections.Dish.create({ name: 'Pho Bo', name_vi: 'Phở bò' });
    const post = await collections.DishPost.create({
        dish_id: String(dish._id),
        user_id: 'author',
        unique_id: `${dish._id}_author`,
        is_best_post: true,
        name: 'Pho Bo',
        ingredients: [String(ing._id)]
    });
    await events.recordUserEvent({ userId: 'u1', type: 'dish_cooked', targetId: String(dish._id) });
    await events.recordUserEvent({ userId: 'u1', type: 'ingredient_picked', targetId: String(ing._id) });
    await collections.Vote.create({ user_id: 'u1', dish_post_id: String(post._id), date_time: new Date() });

    const signals = await events.loadUserSignals('u1');
    assert.ok(signals.likedIngredientIds.has(String(ing._id)));
    const boost = signals.dishBoosts.get(String(dish._id));
    assert.ok(boost && boost.score >= 5);
});
