const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';

let mongod;
let collections;
let mongoose;
let httpServer;
let baseUrl;
let user;

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('dish_suggestions_test');

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;
    mongoose = connection.mongoose;

    user = await collections.User.create({
        username: 'cook1',
        email: 'cook1@example.com',
        password: 'x',
        roles: []
    });

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/dish', require('../routes/api/dish'));
    httpServer = app.listen(0);
    await once(httpServer, 'listening');
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
    if (httpServer) httpServer.close();
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) await mongod.stop();
});

beforeEach(async () => {
    await Promise.all([
        collections.Dish.deleteMany({}),
        collections.DishPost.deleteMany({}),
        collections.Ingredient.deleteMany({}),
        collections.UserEvent.deleteMany({})
    ]);
});

const tokenFor = (account) => jwt.sign({ id: account._id }, process.env.JWT_SECRET, { expiresIn: 60 });

const get = async (query, token = tokenFor(user)) => {
    const headers = token ? { cookie: `token=${token}` } : {};
    const response = await fetch(`${baseUrl}/api/dish/suggestions${query}`, { headers });
    return { status: response.status, body: await response.json() };
};

const ingredientId = () => String(new mongoose.Types.ObjectId());

const seedDish = async ({ name, ingredients, points = 0 }) => {
    const dish = await collections.Dish.create({ name, name_vi: `${name} VI` });
    await collections.DishPost.create({
        dish_id: String(dish._id),
        user_id: 'seed',
        unique_id: `${dish._id}_seed`,
        is_best_post: true,
        name,
        ingredients,
        points,
        profile_image: `${name}.png`,
        servings: 2
    });
    return dish;
};

const cookedEvent = (dish) => collections.UserEvent.create({
    user_id: user._id,
    type: 'dish_cooked',
    target_type: 'dish',
    target_id: String(dish._id),
    day: '2026-11-26',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 86400 * 1000)
});

const pickedEvent = (ingredient) => collections.UserEvent.create({
    user_id: user._id,
    type: 'ingredient_picked',
    target_type: 'ingredient',
    target_id: String(ingredient),
    day: '2026-11-26',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 86400 * 1000)
});

test('ranking orders dishes by how much of the pantry they cover', async () => {
    const [i1, i2, i3] = [ingredientId(), ingredientId(), ingredientId()];
    const full = await seedDish({ name: 'Full', ingredients: [i1, i2] });
    const half = await seedDish({ name: 'Half', ingredients: [i1] });
    await seedDish({ name: 'Other', ingredients: [i3] });

    const { status, body } = await get(`?ingredients=${i1},${i2}`);

    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.rows.map(row => row.dish_id), [String(full._id), String(half._id)]);
    assert.strictEqual(body.rows[0].score, 4);
    assert.strictEqual(body.rows[1].score, 2);
    assert.strictEqual(body.rows[0].image, 'Full.png');
    assert.strictEqual(body.rows[0].servings, 2);
    assert.strictEqual(body.rows[0].name_vi, 'Full VI');
});

test('a recent dish_cooked bonus moves a dish above a more popular one', async () => {
    const i1 = ingredientId();
    await seedDish({ name: 'Popular', ingredients: [i1], points: 5 });
    const homey = await seedDish({ name: 'Homey', ingredients: [i1] });
    await cookedEvent(homey);

    const { status, body } = await get(`?ingredients=${i1}`);

    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.rows.map(row => row.name), ['Homey', 'Popular']);
    assert.strictEqual(body.rows[0].score, 5);
    assert.ok(body.rows[0].reasons.includes('cooked_before'));
});

test('a recent ingredient_picked bonus lifts a dish using that ingredient', async () => {
    const [i1, i2] = [ingredientId(), ingredientId()];
    await seedDish({ name: 'Plain', ingredients: [i1] });
    const pickedDish = await seedDish({ name: 'Picked', ingredients: [i1, i2] });
    await pickedEvent(i2);

    const { status, body } = await get(`?ingredients=${i1}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.rows[0].dish_id, String(pickedDish._id));
    assert.strictEqual(body.rows[0].score, 3);
    assert.deepStrictEqual(body.rows[0].reasons, ['matches_pantry', 'picked_before']);
});

test('reasons list matches_pantry, cooked_before, picked_before and popular', async () => {
    const [i1, i2] = [ingredientId(), ingredientId()];
    const top = await seedDish({ name: 'Top', ingredients: [i1], points: 9 });
    const picked = await seedDish({ name: 'Picked', ingredients: [i1, i2], points: 5 });
    await seedDish({ name: 'Plain', ingredients: [i1], points: 0 });
    await cookedEvent(top);
    await pickedEvent(i2);

    const { status, body } = await get(`?ingredients=${i1},${i2}`);

    assert.strictEqual(status, 200);
    const byName = new Map(body.rows.map(row => [row.name, row.reasons]));
    assert.deepStrictEqual(byName.get('Top'), ['matches_pantry', 'cooked_before', 'popular']);
    assert.deepStrictEqual(byName.get('Picked'), ['matches_pantry', 'picked_before']);
    assert.deepStrictEqual(byName.get('Plain'), ['matches_pantry']);
});

test('an empty pantry answers an empty list', async () => {
    const i1 = ingredientId();
    await seedDish({ name: 'Any', ingredients: [i1] });

    for (const query of ['', '?ingredients=', '?ingredients=,']) {
        const { status, body } = await get(query);
        assert.strictEqual(status, 200);
        assert.deepStrictEqual(body.rows, []);
    }
});

test('a well-formed id that matches no ingredient is ignored', async () => {
    const { status, body } = await get(`?ingredients=${ingredientId()}`);
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.rows, []);
});

test('suggestions require a session', async () => {
    const { status } = await get('', null);
    assert.strictEqual(status, 401);
});

test('an ingredient id that is not an ObjectId answers 400', async () => {
    const { status, body } = await get('?ingredients=not-an-id');
    assert.strictEqual(status, 400);
    assert.strictEqual(body.error, 'invalid_ingredient_id');
});
