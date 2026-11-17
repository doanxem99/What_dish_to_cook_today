const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');

const connectionPath = require.resolve('../config/database/connection');
require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            DishPost: {
                find: () => ({
                    limit: async () => [
                        { dish_id: 'd1', short_detail: 'Broth', short_detail_vi: 'Nước dùng', profile_image: 'a.png', ingredients: ['i1', 'i2', 'i3'] }
                    ]
                })
            },
            Dish: {
                find: async () => [{ _id: 'd1', name: 'Phở', name_vi: 'Phở bò' }]
            }
        }
    }
};

const router = require('../routes/api/dish_selection');

test('selection reports how many chosen ingredients each dish matches', async () => {
    const app = express();
    app.use('/api/dish/selection', router);
    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dish/selection/ingredients/i1-i2`);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.data[0].match_count, 2);
        assert.strictEqual(body.data[0].total_ingredients, 3);
        assert.deepStrictEqual(body.data[0].matched_ids, ['i1', 'i2']);
    } finally {
        server.close();
    }
});
