const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const call = { filter: null };
require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            Dish: {
                find(filter) {
                    call.filter = filter;
                    return { limit: async () => [{ _id: 'a', name: 'Beef stew', name_vi: 'Bò hầm', best_post_id: 'p1' }] };
                }
            },
            DishPost: { find: async () => [{ _id: 'p1', short_detail: 'Rich stew' }] }
        }
    }
};

const router = require('../routes/api/dish_search');

test('dish search matches the Vietnamese name too', async () => {
    const app = express();
    app.use('/api/dish/search', router);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/dish/search/keyword/${encodeURIComponent('bò')}`
        );

        assert.strictEqual(response.status, 200);
        assert.match(JSON.stringify(call.filter), /name_vi/);
    } finally {
        server.close();
    }
});
