const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const captured = { filter: null, adminLookup: null };
let adminExists = true;

require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            User: {
                findOne: async (filter) => {
                    captured.adminLookup = filter;
                    return adminExists ? { _id: '507f1f77bcf86cd799439011' } : null;
                }
            },
            DishPost: {
                find: (filter) => {
                    captured.filter = filter;
                    return {
                        limit: async () => [
                            { dish_id: 'd1', user_id: 'u9', short_detail: 'Weeknight dinner', short_detail_vi: 'Bữa tối', profile_image: 'a.png' },
                            //A legacy post without an author must not appear as homemade
                            { dish_id: 'd1', short_detail: 'No author', short_detail_vi: null, profile_image: 'b.png' }
                        ]
                    };
                }
            },
            Dish: {
                find: async () => [{ _id: 'd1', name: 'Rice bowl', name_vi: 'Cơm tô' }]
            }
        }
    }
};

const router = require('../routes/api/dish_selection');

test('homemade lists best posts that are not from the seed admin', async () => {
    const app = express();
    app.use('/api/dish/selection', router);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dish/selection/homemade`);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.isSuccess, true);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].id, 'd1');
        assert.strictEqual(body.data[0].name_vi, 'Cơm tô');
        assert.deepStrictEqual(captured.adminLookup, { username: 'moonshine@gmail.com' });
        assert.strictEqual(captured.filter.is_best_post, true);
        assert.strictEqual(captured.filter.user_id.$exists, true);
        assert.deepStrictEqual(captured.filter.user_id.$nin, ['unknow', '507f1f77bcf86cd799439011']);
    } finally {
        server.close();
    }
});

test('homemade answers an empty list when the seed admin is missing', async () => {
    adminExists = false;
    const app = express();
    app.use('/api/dish/selection', router);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dish/selection/homemade`);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.data, []);
    } finally {
        server.close();
        adminExists = true;
    }
});
