const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');

//Stub the database module so the routers can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const call = { dish: {}, ingredient: {} };

require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            Dish: {
                find(filter, fields) {
                    call.dish = { filter, fields };
                    return {
                        limit: async () => [
                            { _id: 'a', name: 'Beef stew', name_vi: 'Bò hầm', best_post_id: 'p1' }
                        ]
                    };
                }
            },
            DishPost: { find: async () => [{ _id: 'p1', short_detail: 'Rich stew', short_detail_vi: 'Hầm đậm' }] },
            Ingredient: {
                find(filter, fields) {
                    call.ingredient = { filter, fields };
                    return {
                        limit: async () => [
                            { _id: 'i1', name: 'Beef', name_vi: 'Thịt bò', best_post_id: 'ip1' }
                        ]
                    };
                }
            }
        }
    }
};

const dishSearch = require('../routes/api/dish_search');
const ingredientSearch = require('../routes/api/ingredient_search');

async function getJson(router, mountPath, urlPath) {
    const app = express();
    app.use(mountPath, router);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${urlPath}`);
        return { status: response.status, body: await response.json() };
    } finally {
        server.close();
    }
}

test('dish search matches and returns the Vietnamese name', async () => {
    const { status, body } = await getJson(dishSearch, '/api/dish/search', '/api/dish/search/keyword/b%C3%B2');

    assert.strictEqual(status, 200);
    //The query must target both name fields with the escaped keyword
    const orFilter = call.dish.filter.$or;
    assert.strictEqual(orFilter.length, 2);
    assert.strictEqual(orFilter[0].name.$regex, 'bò');
    assert.strictEqual(orFilter[1].name_vi.$regex, 'bò');
    assert.strictEqual(orFilter[1].name_vi.$options, 'i');
    //The projection and the response must both carry the Vietnamese fields
    assert.match(call.dish.fields, /name_vi/);
    assert.strictEqual(body[0].name_vi, 'Bò hầm');
    assert.strictEqual(body[0].short_detail_vi, 'Hầm đậm');
});

test('ingredient search matches and returns the Vietnamese name', async () => {
    const { status, body } = await getJson(
        ingredientSearch,
        '/api/ingredient/search',
        '/api/ingredient/search/keyword/th%E1%BB%8Bt'
    );

    assert.strictEqual(status, 200);
    const orFilter = call.ingredient.filter.$or;
    assert.strictEqual(orFilter.length, 2);
    assert.strictEqual(orFilter[1].name_vi.$regex, 'thịt');
    assert.match(call.ingredient.fields, /name_vi/);
    assert.strictEqual(body[0].name_vi, 'Thịt bò');
});
