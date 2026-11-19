const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';

let mongod;
let collections;
let httpServer;
let baseUrl;

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('admin_ai_test');
    process.env.AI_ENABLED = 'true';

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/admin', require('../routes/api/admin'));

    httpServer = app.listen(0);
    await once(httpServer, 'listening');
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
    if (httpServer) httpServer.close();
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) await mongod.stop();
});

beforeEach(async () => {
    await Promise.all([
        collections.User.deleteMany({}),
        collections.Role.deleteMany({}),
        collections.AiCall.deleteMany({}),
        collections.AuditLog.deleteMany({}),
        collections.AdminJob.deleteMany({}),
        collections.Setting.deleteMany({})
    ]);
});

const makeAdminToken = async () => {
    const role = await collections.Role.create({ name: 'admin', description: 'Admin' });
    const admin = await collections.User.create({
        username: 'boss',
        email: 'boss@example.com',
        password: bcrypt.hashSync('pass', 10),
        roles: [role._id]
    });
    return { admin, token: jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: 60 }) };
};

test('GET /api/admin/ai/usage aggregates ai_call rows without prompt text', async () => {
    const { admin, token } = await makeAdminToken();
    await collections.AiCall.create({
        user_id: admin._id,
        provider: 'opencode-go',
        model: 'deepseek-v4.1-flash',
        mode: 'cook',
        capability: 'read_only',
        latency_ms: 420,
        tokens_in: 200,
        tokens_out: 80,
        cost_estimate: 0.000078,
        status: 'ok',
        created_at: new Date('2026-11-19T12:00:00Z')
    });

    const res = await fetch(`${baseUrl}/api/admin/ai/usage`, { headers: { cookie: `token=${token}` } });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.totals.calls, 1);
    assert.strictEqual(body.totals.tokens_in, 200);
    assert.strictEqual(body.by_day.length, 1);
    assert.strictEqual(body.recent[0].latency_ms, 420);
    assert.strictEqual(body.recent[0].prompt, undefined);
});

test('POST /api/admin/ai/enabled, /api/admin/ai/users/:id, and /api/admin/ai/reindex mutate state and record audit rows', async () => {
    const { admin, token } = await makeAdminToken();

    const toggleRes = await fetch(`${baseUrl}/api/admin/ai/enabled`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `token=${token}` },
        body: JSON.stringify({ enabled: false })
    });
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual((await toggleRes.json()).enabled, false);

    const userRes = await fetch(`${baseUrl}/api/admin/ai/users/${admin._id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `token=${token}` },
        body: JSON.stringify({ disabled: true, daily_limit: 5 })
    });
    assert.strictEqual(userRes.status, 200);
    const updatedUser = await userRes.json();
    assert.strictEqual(updatedUser.ai_disabled, true);
    assert.strictEqual(updatedUser.ai_daily_limit, 5);

    const reindexRes = await fetch(`${baseUrl}/api/admin/ai/reindex`, {
        method: 'POST',
        headers: { cookie: `token=${token}` }
    });
    assert.strictEqual(reindexRes.status, 202);

    const audits = await collections.AuditLog.find({}).sort({ created_at: 1 });
    assert.deepStrictEqual(audits.map(a => a.action), ['ai.enabled', 'user.ai', 'job.ai_index']);
});
