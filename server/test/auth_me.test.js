const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');

process.env.JWT_SECRET = 'test-secret';

//Stub the database module so the router can load without MongoDB
const connectionPath = require.resolve('../config/database/connection');
const user = { _id: 'u1', username: 'ana', email: 'a@b.c', roles: ['r1'] };

require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
        mongoose: {},
        collections: {
            User: {
                findOne: () => ({ populate: async () => user })
            },
            Role: {
                find: async () => [{ name: 'user' }]
            }
        }
    }
};

const auth = require('../routes/api/auth');

async function getMe() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', auth);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: 60 });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`, {
            headers: { cookie: `token=${token}` }
        });
        return { status: response.status, body: await response.json() };
    } finally {
        server.close();
    }
}

test('GET /api/auth/me returns the signed-in user', async () => {
    const { status, body } = await getMe();

    assert.strictEqual(status, 200);
    assert.strictEqual(body.user.id, 'u1');
    assert.strictEqual(body.user.username, 'ana');
    assert.deepStrictEqual(body.user.roles, ['user']);
    //Users created before the field existed have no joined date
    assert.strictEqual(body.user.created_at, null);
});

test('GET /api/auth/me rejects a request without a token', async () => {
    const app = express();
    app.use(cookieParser());
    app.use('/api/auth', auth);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`);
        assert.strictEqual(response.status, 401);
    } finally {
        server.close();
    }
});
