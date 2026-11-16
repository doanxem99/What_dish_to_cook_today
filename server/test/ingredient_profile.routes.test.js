const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const { once } = require('node:events');

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: { mongoose: {}, collections: {} }
};

const ingredientProfile = require('../routes/api/ingredient_profile');

//The PATCH route trusted a body-supplied user id and crashed on a missing body.
//Editing an existing post already happens through create_ingredient_post, so the
//route is gone and the endpoint must answer 404.
test('PATCH update_ingredient_post is not exposed', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/ingredient/profile', ingredientProfile);

    const server = app.listen(0);
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const response = await fetch(baseUrl + '/api/ingredient/profile/update_ingredient_post', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: '{}'
        });

        assert.strictEqual(response.status, 404);
    } finally {
        server.close();
    }
});
