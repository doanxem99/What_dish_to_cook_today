const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');

process.env.JWT_SECRET = 'test-secret';

//Stub the database module so the routers can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const queries = { dish: { filter: null, sort: null, limit: null }, ingredient: { filter: null, sort: null, limit: null } };
let dishRows = [
    { _id: 'p1', name: 'Stew', name_vi: 'Món hầm', short_detail: 'Warm', profile_image: 'a.png', is_best_post: true, date_time: new Date() },
    { _id: 'p2', name: 'Soup', short_detail: 'Light', profile_image: 'b.png', is_best_post: false, date_time: new Date() }
];
let ingredientRows = [
    { _id: 'ip1', name: 'Beef', type: 'Food', short_detail: 'Red meat', profile_image: 'c.png', is_best_post: false, date_time: new Date() }
];

const listStub = (bucket, getRows) => (filter) => {
    bucket.filter = filter;
    return {
        sort: (spec) => {
            bucket.sort = spec;
            return {
                limit: async (count) => {
                    bucket.limit = count;
                    return getRows();
                }
            };
        }
    };
};

require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            User: {
                findOne: () => ({ populate: async () => ({ _id: 'u1', username: 'ana', roles: ['r1'] }) })
            },
            Role: { find: async () => [{ name: 'user' }] },
            DishPost: { find: listStub(queries.dish, () => dishRows) },
            IngredientPost: {
                find: (filter) => {
                    queries.ingredient.filter = filter;
                    return {
                        sort: (spec) => {
                            queries.ingredient.sort = spec;
                            return {
                                limit: async (count) => {
                                    queries.ingredient.limit = count;
                                    return ingredientRows;
                                }
                            };
                        }
                    };
                }
            }
        }
    }
};

const dishProfile = require('../routes/api/dish_profile');
const ingredientProfile = require('../routes/api/ingredient_profile');

async function get(router, mountPath, path) {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(mountPath, router);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
            headers: { cookie: `token=${jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: 60 })}` }
        });
        return { status: response.status, body: await response.json() };
    } finally {
        server.close();
    }
}

test('dish mine lists the token user posts with the best flag', async () => {
    const { status, body } = await get(dishProfile, '/api/dish/profile', '/api/dish/profile/mine');

    assert.strictEqual(status, 200);
    assert.strictEqual(queries.dish.filter.user_id, 'u1');
    assert.deepStrictEqual(queries.dish.sort, { date_time: -1 });
    assert.strictEqual(queries.dish.limit, 50);
    assert.strictEqual(body.data.length, 2);
    assert.strictEqual(body.data[0].is_best_post, true);
    assert.strictEqual(body.data[0].name_vi, 'Món hầm');
    assert.strictEqual(body.data[1].is_best_post, false);
});

test('ingredient mine lists the token user posts', async () => {
    const { status, body } = await get(ingredientProfile, '/api/ingredient/profile', '/api/ingredient/profile/mine');

    assert.strictEqual(status, 200);
    assert.strictEqual(queries.ingredient.filter.user_id, 'u1');
    assert.deepStrictEqual(queries.ingredient.sort, { date_time: -1 });
    assert.strictEqual(queries.ingredient.limit, 50);
    assert.strictEqual(body.data.length, 1);
    assert.strictEqual(body.data[0].type, 'Food');
});

test('mine answers an empty list for a user without posts', async () => {
    const backup = dishRows;
    dishRows = [];

    const { status, body } = await get(dishProfile, '/api/dish/profile', '/api/dish/profile/mine');

    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.data, []);
    dishRows = backup;
});

test('mine requires a session', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/dish/profile', dishProfile);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dish/profile/mine`);
        assert.strictEqual(response.status, 401);
    } finally {
        server.close();
    }
});
