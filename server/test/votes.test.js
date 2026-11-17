const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');

process.env.JWT_SECRET = 'test-secret';

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const updates = [];
const deletes = [];
const creates = [];
let existingVote = null;
let postExists = true;

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
            DishPost: {
                findById: async () => (postExists ? { _id: 'p1', points: 0 } : null),
                findByIdAndUpdate: async (id, update) => {
                    updates.push(update);
                    return { _id: id, points: update.$inc.points };
                }
            },
            Vote: {
                findOne: async () => existingVote,
                create: async (doc) => {
                    creates.push(doc);
                    return { _id: 'v1', ...doc };
                },
                deleteOne: async (filter) => {
                    deletes.push(filter);
                    return { deletedCount: 1 };
                }
            }
        }
    }
};

const dishProfile = require('../routes/api/dish_profile');

async function vote(withToken) {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/dish/profile', dishProfile);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const headers = {};
        if (withToken) {
            headers.cookie = `token=${jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: 60 })}`;
        }
        const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/dish/profile/vote/p1`,
            { method: 'POST', headers }
        );
        return { status: response.status, body: await response.json() };
    } finally {
        server.close();
    }
}

test('first vote creates the row and increments points', async () => {
    existingVote = null;

    const { status, body } = await vote(true);

    assert.strictEqual(status, 200);
    assert.strictEqual(creates.length, 1);
    assert.strictEqual(creates[0].user_id, 'u1');
    assert.deepStrictEqual(updates[0], { $inc: { points: 1 } });
    assert.strictEqual(body.data.voted, true);
});

test('second vote removes the row and decrements points', async () => {
    existingVote = { _id: 'v1', user_id: 'u1', dish_post_id: 'p1' };

    const { status, body } = await vote(true);

    assert.strictEqual(status, 200);
    assert.strictEqual(deletes.length, 1);
    assert.deepStrictEqual(updates[updates.length - 1], { $inc: { points: -1 } });
    assert.strictEqual(body.data.voted, false);
});

test('vote requires a session', async () => {
    const { status } = await vote(false);

    assert.strictEqual(status, 401);
});

test('vote on a missing dish post answers 404', async () => {
    postExists = false;
    const before = updates.length;

    const { status } = await vote(true);

    assert.strictEqual(status, 404);
    assert.strictEqual(updates.length, before);
    postExists = true;
});
