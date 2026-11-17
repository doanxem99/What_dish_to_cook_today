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
const commentCounts = [];
let otherComment = { _id: 'c9', user_id: 'u2', body: 'not yours', dish_post_id: 'p1', date_time: new Date() };
let postExists = true;
let deleteReturnsNull = false;

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
            DishPost: {
                findById: async () => (postExists ? { _id: 'p1' } : null),
                updateOne: async (filter, update) => { commentCounts.push(update); }
            },
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
                    if (deleteReturnsNull) {
                        return null;
                    }
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
    //dish_post.comments stays the visible counter used by the dish card
    assert.deepStrictEqual(commentCounts[0], { $inc: { comments: 1 } });
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

test('POST rejects a comment for a missing dish post', async () => {
    postExists = false;
    const createdBefore = created.length;

    const { status } = await call('POST', '/comment/does-not-exist', { body: 'Hello' }, true);

    assert.strictEqual(status, 404);
    assert.strictEqual(created.length, createdBefore);
    postExists = true;
});

test('DELETE answers 404 when the comment was already removed', async () => {
    otherComment = { _id: 'c4', user_id: 'u1', body: 'mine', dish_post_id: 'p1', date_time: new Date() };
    deleteReturnsNull = true;
    const countsBefore = commentCounts.length;

    const { status } = await call('DELETE', '/comment/c4', undefined, true);

    assert.strictEqual(status, 404);
    //No counter change when nothing was deleted (concurrent delete, retry)
    assert.strictEqual(commentCounts.length, countsBefore);
    deleteReturnsNull = false;
});

test('DELETE removes the author comment and decrements the counter', async () => {
    deleteReturnsNull = false;
    otherComment = { _id: 'c3', user_id: 'u1', body: 'mine', dish_post_id: 'p1', date_time: new Date() };

    const { status } = await call('DELETE', '/comment/c3', undefined, true);

    assert.strictEqual(status, 200);
    assert.deepStrictEqual(deleted, ['c3']);
    assert.deepStrictEqual(commentCounts[commentCounts.length - 1], { $inc: { comments: -1 } });
});
