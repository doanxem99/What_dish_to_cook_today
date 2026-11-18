const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');
const profileEnum = require('../config/enum/profile_enum');

process.env.JWT_SECRET = 'test-secret';

let mongod;
let collections;
let mongoose;
let httpServer;
let baseUrl;

const seedRole = async function(name) {
    return collections.Role.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, description: `${name} role` } },
        { new: true, upsert: true }
    );
};

const createUser = async function(username, roles = ['user']) {
    const roleDocs = await Promise.all(roles.map(seedRole));
    return collections.User.create({
        username,
        email: `${username}@example.com`,
        password: 'x',
        roles: roleDocs.map(doc => doc._id)
    });
};

const tokenFor = function(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: 60 });
};

const call = async function(path, token, method = 'GET', body) {
    const headers = {};
    if (token) {
        headers.cookie = `token=${token}`;
    }
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
};

const createDishFixture = async function(options) {
    return collections.Dish.create({ name: options.name, best_post_id: '' });
};

const createDishPostFixture = async function(dish, user, name) {
    return collections.DishPost.create({
        name,
        dish_id: String(dish._id),
        user_id: user._id,
        unique_id: `${dish._id}_${user._id}`,
        date_time: new Date().toJSON(),
        points: 0,
        ingredients: [],
        short_detail: 'fixture',
        profile_image: '',
        images: [],
        display_blocks: []
    });
};

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('audit_content_test');

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;
    mongoose = connection.mongoose;

    const app = express();
    app.use(express.json());
    app.use(require('../config/body_error'));
    app.use(cookieParser());
    app.use('/api/dish/profile', require('../routes/api/dish_profile'));
    app.use('/api/ingredient/profile', require('../routes/api/ingredient_profile'));
    app.use('/api/admin', require('../routes/api/admin'));

    httpServer = app.listen(0);
    await once(httpServer, 'listening');
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
    if (httpServer) {
        httpServer.close();
    }
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});

beforeEach(async () => {
    await Promise.all([
        collections.User.deleteMany({}),
        collections.Role.deleteMany({}),
        collections.AuditLog.deleteMany({}),
        collections.Dish.deleteMany({}),
        collections.DishPost.deleteMany({}),
        collections.Ingredient.deleteMany({}),
        collections.IngredientPost.deleteMany({}),
        collections.Comment.deleteMany({})
    ]);
});

test('a successful dish create writes exactly one dish.create row', async () => {
    const cook = await createUser('cook');

    const response = await call('/api/dish/profile/create_dish', tokenFor(cook), 'POST', {
        name: 'Pho Bo',
        ingredients: [],
        short_detail: 'Beef noodle soup',
        profile_image: '',
        display_blocks: []
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 0);
    //The nested dish post create is part of this request, so it must not add a second row.
    const rows = await collections.AuditLog.find({});
    assert.strictEqual(rows.length, 1);
    const row = rows[0];
    assert.strictEqual(row.action, 'dish.create');
    assert.strictEqual(row.actor_name, 'cook');
    assert.strictEqual(row.target_type, 'dish');
    assert.strictEqual(row.target_id, String(response.body.dish_id));
    assert.strictEqual(row.detail, 'Pho Bo');
    assert.strictEqual(row.result, 'ok');
});

test('a successful dish post create writes one dish_post.create row', async () => {
    const cook = await createUser('cook');
    const dish = await createDishFixture({ name: 'Pho' });

    const response = await call('/api/dish/profile/create_dish_post', tokenFor(cook), 'POST', {
        dish_id: String(dish._id),
        data: {
            name: 'Pho',
            ingredients: [],
            short_detail: 'Beef noodle soup',
            profile_image: '',
            display_blocks: []
        }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 0);
    const rows = await collections.AuditLog.find({ action: 'dish_post.create' });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].actor_name, 'cook');
    assert.strictEqual(rows[0].target_type, 'dish_post');
    assert.strictEqual(rows[0].target_id, String(response.body.dish_post_id));
    assert.strictEqual(rows[0].detail, 'Pho');
});

test('a successful ingredient create writes one ingredient.create row', async () => {
    const cook = await createUser('cook');

    const response = await call('/api/ingredient/profile/create_ingredient', tokenFor(cook), 'POST', {
        name: 'Beef',
        type: 'meat',
        short_detail: 'Red meat',
        profile_image: '',
        display_blocks: []
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 0);
    const rows = await collections.AuditLog.find({ action: 'ingredient.create' });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].actor_name, 'cook');
    assert.strictEqual(rows[0].target_type, 'ingredient');
    assert.strictEqual(rows[0].target_id, String(response.body.ingredient_id));
    assert.strictEqual(rows[0].detail, 'Beef');
});

test('a successful ingredient post create writes one ingredient_post.create row', async () => {
    const cook = await createUser('cook');
    const ingredient = await collections.Ingredient.create({ name: 'Beef', best_post_id: '' });

    const response = await call('/api/ingredient/profile/create_ingredient_post', tokenFor(cook), 'POST', {
        ingredient_id: String(ingredient._id),
        ingredient_name: 'Beef',
        data: {
            type: 'meat',
            short_detail: 'Red meat',
            profile_image: '',
            display_blocks: []
        }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 0);
    const rows = await collections.AuditLog.find({ action: 'ingredient_post.create' });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].actor_name, 'cook');
    assert.strictEqual(rows[0].target_type, 'ingredient_post');
    assert.strictEqual(rows[0].target_id, String(response.body.ingredient_post_id));
    assert.strictEqual(rows[0].detail, 'Beef');
});

test('a post edit writes the edit action, not a second create', async () => {
    const cook = await createUser('cook');
    const dish = await createDishFixture({ name: 'Pho' });
    const postBody = {
        dish_id: String(dish._id),
        data: {
            name: 'Pho',
            ingredients: [],
            short_detail: 'Beef noodle soup',
            profile_image: '',
            display_blocks: []
        }
    };

    await call('/api/dish/profile/create_dish_post', tokenFor(cook), 'POST', postBody);
    const second = await call('/api/dish/profile/create_dish_post', tokenFor(cook), 'POST', postBody);

    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.status, profileEnum.ProfileStatus_PostCreate.EditingSuccess);
    assert.strictEqual(await collections.AuditLog.countDocuments({ action: 'dish_post.create' }), 1);
    const edits = await collections.AuditLog.find({ action: 'dish_post.edit' });
    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].target_id, String(second.body.dish_post_id));
});

test('an ingredient post edit writes the edit action, not a second create', async () => {
    const cook = await createUser('cook');
    const ingredient = await collections.Ingredient.create({ name: 'Beef', best_post_id: '' });
    const postBody = {
        ingredient_id: String(ingredient._id),
        ingredient_name: 'Beef',
        data: {
            type: 'meat',
            short_detail: 'Red meat',
            profile_image: '',
            display_blocks: []
        }
    };

    await call('/api/ingredient/profile/create_ingredient_post', tokenFor(cook), 'POST', postBody);
    const second = await call('/api/ingredient/profile/create_ingredient_post', tokenFor(cook), 'POST', postBody);

    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.status, profileEnum.ProfileStatus_PostCreate.EditingSuccess);
    assert.strictEqual(await collections.AuditLog.countDocuments({ action: 'ingredient_post.create' }), 1);
    const edits = await collections.AuditLog.find({ action: 'ingredient_post.edit' });
    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].target_id, String(second.body.ingredient_post_id));
});

test('a failed audit write still answers the create with 200', async () => {
    const cook = await createUser('cook');
    const original = collections.AuditLog.create;
    collections.AuditLog.create = async () => {
        throw new Error('audit down');
    };
    try {
        const dish = await call('/api/dish/profile/create_dish', tokenFor(cook), 'POST', {
            name: 'Pho Bo',
            ingredients: [],
            short_detail: 'Beef noodle soup',
            profile_image: '',
            display_blocks: []
        });
        const ingredient = await call('/api/ingredient/profile/create_ingredient', tokenFor(cook), 'POST', {
            name: 'Beef',
            type: 'meat',
            short_detail: 'Red meat',
            profile_image: '',
            display_blocks: []
        });

        assert.strictEqual(dish.status, 200);
        assert.strictEqual(dish.body.status, 0);
        assert.strictEqual(ingredient.status, 200);
        assert.strictEqual(ingredient.body.status, 0);
    } finally {
        collections.AuditLog.create = original;
    }
    assert.strictEqual(await collections.AuditLog.countDocuments({}), 0);
});

test('a rejected create writes no audit row', async () => {
    const cook = await createUser('cook');

    const dish = await call('/api/dish/profile/create_dish', tokenFor(cook), 'POST', {
        name: 'Pho 123',
        ingredients: [],
        short_detail: '',
        profile_image: '',
        display_blocks: []
    });
    const ingredient = await call('/api/ingredient/profile/create_ingredient', tokenFor(cook), 'POST', {
        name: '123',
        type: 'meat',
        short_detail: '',
        profile_image: ''
    });

    assert.notStrictEqual(dish.body.status, 0);
    assert.notStrictEqual(ingredient.body.status, 0);
    assert.strictEqual(await collections.AuditLog.countDocuments({}), 0);
});

test('deleting a comment writes one comment.delete row with a short excerpt', async () => {
    const cook = await createUser('cook');
    const other = await createUser('other');
    const dish = await createDishFixture({ name: 'Pho' });
    const post = await createDishPostFixture(dish, cook, 'Pho');
    const body = 'This soup was great. '.repeat(10).trim();
    const comment = await collections.Comment.create({
        dish_post_id: String(post._id),
        user_id: cook._id,
        body,
        date_time: new Date()
    });

    const forbidden = await call(`/api/dish/profile/comment/${comment._id}`, tokenFor(other), 'DELETE');
    assert.strictEqual(forbidden.status, 403);
    assert.strictEqual(await collections.AuditLog.countDocuments({}), 0);

    const response = await call(`/api/dish/profile/comment/${comment._id}`, tokenFor(cook), 'DELETE');

    assert.strictEqual(response.status, 200);
    const rows = await collections.AuditLog.find({ action: 'comment.delete' });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].actor_name, 'cook');
    assert.strictEqual(rows[0].target_type, 'comment');
    assert.strictEqual(rows[0].target_id, String(comment._id));
    assert.ok(rows[0].detail.length <= 83);
    assert.ok(rows[0].detail.startsWith('comment: This soup was great.'));
    assert.notStrictEqual(rows[0].detail, body);
});

test('the audit list paginates and lists the new actions', async () => {
    const admin = await createUser('boss', ['admin']);
    const actions = ['dish.create', 'dish_post.create', 'dish_post.edit', 'ingredient.create', 'ingredient_post.create', 'ingredient_post.edit', 'comment.delete'];
    for (let index = 0; index < 30; index += 1) {
        await collections.AuditLog.create({
            actor_name: 'boss',
            action: actions[index % actions.length],
            result: 'ok',
            created_at: new Date(Date.now() + index * 1000)
        });
    }

    const response = await call('/api/admin/audit?page=2', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.total, 30);
    assert.strictEqual(response.body.rows.length, 5);
    assert.deepStrictEqual(response.body.actions, [...actions].sort());
});

test('post and comment targets resolve to readable labels', async () => {
    const admin = await createUser('boss', ['admin']);
    const cook = await createUser('cook');
    const dish = await createDishFixture({ name: 'Pho' });
    const dishPost = await createDishPostFixture(dish, cook, 'Pho');
    const ingredient = await collections.Ingredient.create({ name: 'Beef', best_post_id: '' });
    const ingredientPost = await collections.IngredientPost.create({
        name: 'Beef',
        ingredient_id: String(ingredient._id),
        user_id: cook._id,
        unique_id: `${ingredient._id}_${cook._id}`,
        date_time: new Date().toJSON(),
        points: 0,
        type: 'meat',
        short_detail: 'fixture',
        profile_image: '',
        display_blocks: []
    });
    const deletedCommentId = String(new mongoose.Types.ObjectId());
    const targets = [
        { target_type: 'dish_post', target_id: String(dishPost._id) },
        { target_type: 'ingredient_post', target_id: String(ingredientPost._id) },
        { target_type: 'comment', target_id: deletedCommentId, detail: 'comment: This soup was great' }
    ];
    for (const [index, target] of targets.entries()) {
        await collections.AuditLog.create({
            actor_name: 'cook',
            action: index === 2 ? 'comment.delete' : 'dish_post.create',
            result: 'ok',
            created_at: new Date(Date.now() + index * 1000),
            ...target
        });
    }

    const response = await call('/api/admin/audit', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    const labels = new Map(response.body.rows.map(row => [row.target_type + ':' + row.target_id, row.target_label]));
    assert.strictEqual(labels.get('dish_post:' + dishPost._id), 'Pho by cook');
    assert.strictEqual(labels.get('ingredient_post:' + ingredientPost._id), 'Beef by cook');
    assert.strictEqual(labels.get('comment:' + deletedCommentId), 'comment: This soup was great');
});

test('a post whose parent is gone keeps its own name as the label', async () => {
    const admin = await createUser('boss', ['admin']);
    const cook = await createUser('cook');
    const dish = await createDishFixture({ name: 'Pho' });
    const dishPost = await createDishPostFixture(dish, cook, 'Pho');
    await collections.Dish.deleteOne({ _id: dish._id });
    const corruptIngredientPost = await collections.IngredientPost.create({
        name: 'Beef',
        ingredient_id: 'not-an-object-id',
        user_id: cook._id,
        unique_id: 'corrupt-parent',
        date_time: new Date().toJSON(),
        points: 0,
        type: 'meat',
        short_detail: 'fixture',
        profile_image: '',
        display_blocks: []
    });
    await collections.AuditLog.create([
        {
            actor_name: 'cook',
            action: 'dish_post.create',
            target_type: 'dish_post',
            target_id: String(dishPost._id),
            result: 'ok',
            created_at: new Date()
        },
        {
            actor_name: 'cook',
            action: 'ingredient_post.create',
            target_type: 'ingredient_post',
            target_id: String(corruptIngredientPost._id),
            result: 'ok',
            created_at: new Date(Date.now() + 1000)
        }
    ]);

    const response = await call('/api/admin/audit', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    const labels = new Map(response.body.rows.map(row => [row.target_type + ':' + row.target_id, row.target_label]));
    assert.strictEqual(labels.get('dish_post:' + dishPost._id), 'Pho by cook');
    assert.strictEqual(labels.get('ingredient_post:' + corruptIngredientPost._id), 'Beef by cook');
});
