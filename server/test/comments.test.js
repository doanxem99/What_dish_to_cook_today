const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');

process.env.JWT_SECRET = 'test-secret';

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const created = [];
const deleted = [];
let otherComment = { _id: 'c9', user_id: 'u2', body: 'not yours', dish_post_id: 'p1', date_time: new Date() };

require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            User: {
                findOne: () => ({ populate: async () => ({ _id: 'u1', username: 'ana', roles: ['r1'] }) }),
                find: async () => [{ _id: 'u1', username: 'ana' }]
            },
            Role: { find: async () => [{ name: 'user' }] },
            Comment: {
                find: () => ({
                    sort: () => ({
                        limit: async () => [
                            { _id: 'c1', user_id: 'u1', body: 'hi', dish_post_id: 'p1', date_time: new Date() }
                        ]
                    })
                }),
                create: async (doc) => {
                    created.push(doc);
                    return { _id: 'c1', ...doc };
                },
                findById: async () => otherComment,
                findByIdAndDelete: async (id) => {
                    deleted.push(id);
                    return otherComment;
                }
            }
        }
    }
};

const dishProfile = require('../routes/api/dish_profile');

async function call(method, path, body, withToken) {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/dish/profile', dishProfile);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const headers = { 'content-type': 'application/json' };
        if (withToken) {
            headers.cookie = `token=${jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: 60 })}`;
        }
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dish/profile${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
    } finally {
        server.close();
    }
}

test('POST comment rejects an empty body', async () => {
    const { status } = await call('POST', '/comment/p1', { body: '   ' }, true);

    assert.strictEqual(status, 400);
    assert.strictEqual(created.length, 0);
});

test('POST comment takes the author from the token, not the body', async () => {
    const { status, body } = await call('POST', '/comment/p1', { body: 'Looks good', user_id: 'u2' }, true);

    assert.strictEqual(status, 200);
    assert.strictEqual(created.length, 1);
    assert.strictEqual(created[0].user_id, 'u1');
    assert.strictEqual(body.data.user_id, 'u1');
    assert.strictEqual(body.data.body, 'Looks good');
});

test('GET comments lists newest first and marks the viewer own comment', async () => {
    const { status, body } = await call('GET', '/comments/p1', undefined, true);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.length, 1);
    assert.strictEqual(body.data[0].username, 'ana');
    assert.strictEqual(body.data[0].is_mine, true);
});

test('DELETE rejects deleting another user comment', async () => {
    const { status } = await call('DELETE', '/comment/c9', undefined, true);

    assert.strictEqual(status, 403);
    assert.strictEqual(deleted.length, 0);
});
