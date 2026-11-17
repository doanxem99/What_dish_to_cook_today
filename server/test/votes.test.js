const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');

process.env.JWT_SECRET = 'test-secret';

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const writes = { creates: 0, deletes: 0 };
let existingVote = null;
let postExists = true;
let postPoints = 5;

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
                findById: async () => (postExists ? { _id: 'p1', points: postPoints } : null),
                findByIdAndUpdate: async (id, update) => {
                    //Array form is the floored decrement; object form is $inc
                    const delta = Array.isArray(update) ? -1 : update.$inc.points;
                    postPoints = Math.max(0, postPoints + delta);
                    return { _id: id, points: postPoints };
                }
            },
            Vote: {
                findOne: async () => existingVote,
                findOneAndDelete: async () => {
                    const found = existingVote;
                    existingVote = null;
                    if (found) {
                        writes.deletes++;
                    }
                    return found;
                },
                create: async (doc) => {
                    writes.creates++;
                    existingVote = { _id: 'v1', ...doc };
                    return existingVote;
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

test('first vote creates the row and increments the real counter', async () => {
    existingVote = null;
    postPoints = 5;

    const { status, body } = await vote(true);

    assert.strictEqual(status, 200);
    assert.strictEqual(writes.creates, 1);
    assert.strictEqual(body.data.voted, true);
    assert.strictEqual(body.data.points, 6);
});

test('second vote removes the row and decrements the real counter', async () => {
    existingVote = { _id: 'v1', user_id: 'u1', dish_post_id: 'p1' };
    postPoints = 6;

    const { status, body } = await vote(true);

    assert.strictEqual(status, 200);
    assert.strictEqual(writes.deletes, 1);
    assert.strictEqual(body.data.voted, false);
    assert.strictEqual(body.data.points, 5);
});

test('vote requires a session and writes nothing', async () => {
    const before = { ...writes };

    const { status } = await vote(false);

    assert.strictEqual(status, 401);
    assert.deepStrictEqual(writes, before);
});

test('vote on a missing dish post answers 404', async () => {
    postExists = false;
    const before = { ...writes };

    const { status } = await vote(true);

    assert.strictEqual(status, 404);
    assert.deepStrictEqual(writes, before);
    postExists = true;
});

test('unvote never takes the counter below zero', async () => {
    existingVote = { _id: 'v2', user_id: 'u1', dish_post_id: 'p1' };
    postPoints = 0;

    const { status, body } = await vote(true);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.voted, false);
    assert.strictEqual(body.data.points, 0);
});
