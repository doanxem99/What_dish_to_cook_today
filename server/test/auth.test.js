const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';

let mongod;
let collections;
let authRouter;
let adminModule;
let httpServer;
let baseUrl;

const seedRole = async function(name) {
    return collections.Role.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, description: `${name} role` } },
        { new: true, upsert: true }
    );
};

const createUser = async function(options) {
    const { username, password = 'demo1234', roles = ['user'], ...rest } = options;
    const roleDocs = await Promise.all(roles.map(seedRole));
    return collections.User.create({
        username,
        email: `${username}@example.com`,
        password: bcrypt.hashSync(password, 10),
        roles: roleDocs.map(doc => doc._id),
        ...rest
    });
};

const signin = async function(username, password) {
    const response = await fetch(`${baseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return {
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get('set-cookie')
    };
};

const tokenFor = function(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: 60 });
};

const getAdminPing = async function(token) {
    const response = await fetch(`${baseUrl}/api/admin/ping`, {
        headers: token ? { cookie: `token=${token}` } : {}
    });
    return { status: response.status, body: await response.json() };
};

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('auth_test');

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;

    authRouter = require('../routes/api/auth');
    adminModule = require('../config/admin/require_admin');

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRouter);
    app.get('/api/admin/ping', adminModule.requireAdmin, (req, res) => {
        res.json({ ok: true, roles: req.roles });
    });

    httpServer = app.listen(0);
    await once(httpServer, 'listening');
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
    if (httpServer) {
        httpServer.close();
    }
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});

test('sign-in returns roles and must_change_password', async () => {
    const user = await createUser({ username: 'ana' });

    const result = await signin('ana', 'demo1234');

    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.body.roles, ['user']);
    assert.strictEqual(result.body.must_change_password, false);
    //Existing fields stay
    assert.strictEqual(result.body.user.username, 'ana');
    //The admin user table needs the id to mark the signed-in account.
    assert.strictEqual(String(result.body.user.id), String(user._id));
    assert.ok(result.cookie);
});

test('sign-in reports a pending password change', async () => {
    await createUser({ username: 'temp', must_change_password: true });

    const result = await signin('temp', 'demo1234');

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.must_change_password, true);
});

test('a disabled account cannot sign in', async () => {
    await createUser({ username: 'blocked', is_disabled: true });

    const result = await signin('blocked', 'demo1234');

    assert.strictEqual(result.status, 401);
    assert.match(result.body.message, /disabled/i);
});

test('requireAdmin rejects an anonymous request with 401', async () => {
    const result = await getAdminPing(null);
    assert.strictEqual(result.status, 401);
});

test('requireAdmin rejects a signed-in normal user with 403', async () => {
    const user = await createUser({ username: 'plain' });

    const result = await getAdminPing(tokenFor(user));

    assert.strictEqual(result.status, 403);
});

test('requireAdmin rejects a disabled admin with 403', async () => {
    const user = await createUser({ username: 'sleepy', roles: ['admin'], is_disabled: true });

    const result = await getAdminPing(tokenFor(user));

    assert.strictEqual(result.status, 403);
});

test('requireAdmin lets an admin through', async () => {
    const user = await createUser({ username: 'boss', roles: ['admin'] });

    const result = await getAdminPing(tokenFor(user));

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.ok, true);
});

test('requireAdmin rejects a user with no roles with 403', async () => {
    const user = await createUser({ username: 'roleless', roles: [] });

    const result = await getAdminPing(tokenFor(user));

    assert.strictEqual(result.status, 403);
});

test('a valid token whose user was deleted answers 401', async () => {
    const user = await createUser({ username: 'ghost' });
    const token = tokenFor(user);
    await collections.User.deleteOne({ _id: user._id });

    const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { cookie: `token=${token}` }
    });

    assert.strictEqual(response.status, 401);
    assert.strictEqual((await response.json()).message, 'User not found!');
});

test('password change refuses a wrong current password', async () => {
    const user = await createUser({ username: 'pw-wrong', must_change_password: true });

    const response = await fetch(`${baseUrl}/api/auth/password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `token=${tokenFor(user)}` },
        body: JSON.stringify({ current_password: 'not-it', new_password: 'newpass123' })
    });

    assert.strictEqual(response.status, 400);
    const stored = await collections.User.findById(user._id);
    assert.strictEqual(stored.must_change_password, true);
    assert.ok(bcrypt.compareSync('demo1234', stored.password));
});

test('password change stores the new hash and clears must_change_password', async () => {
    const user = await createUser({ username: 'pw-change', must_change_password: true });

    const response = await fetch(`${baseUrl}/api/auth/password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `token=${tokenFor(user)}` },
        body: JSON.stringify({ current_password: 'demo1234', new_password: 'newpass123' })
    });

    assert.strictEqual(response.status, 200);
    const stored = await collections.User.findById(user._id);
    assert.strictEqual(stored.must_change_password, false);
    assert.ok(bcrypt.compareSync('newpass123', stored.password));

    const result = await signin('pw-change', 'newpass123');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.must_change_password, false);
});

test('the last admin cannot be demoted', () => {
    assert.strictEqual(adminModule.canDemoteAdmin(1), false);
    assert.strictEqual(adminModule.canDemoteAdmin(0), false);
    assert.strictEqual(adminModule.canDemoteAdmin(2), true);
});

test('boot promotion makes ADMIN_USERNAME an admin once', async () => {
    process.env.ADMIN_USERNAME = 'moonshine@gmail.com';
    const user = await createUser({ username: 'moonshine@gmail.com' });

    assert.strictEqual(await authRouter.promoteAdmin(), true);
    assert.strictEqual(await authRouter.promoteAdmin(), true);

    const stored = await collections.User.findById(user._id).populate('roles');
    const names = stored.roles.map(role => role.name);
    assert.strictEqual(names.filter(name => name === 'admin').length, 1);
    assert.deepStrictEqual(names.sort(), ['admin', 'user']);
    assert.strictEqual(await collections.Role.countDocuments({ name: 'admin' }), 1);
});

test('boot promotion ignores a missing account', async () => {
    process.env.ADMIN_USERNAME = 'nobody@example.com';

    assert.strictEqual(await authRouter.promoteAdmin(), false);
    delete process.env.ADMIN_USERNAME;
});

test('an admin sign-in writes an audit row without password material', async () => {
    const user = await createUser({ username: 'audit-admin', roles: ['admin'] });

    const result = await signin('audit-admin', 'demo1234');

    assert.strictEqual(result.status, 200);
    const row = await collections.AuditLog.findOne({ action: 'admin.signin', target_id: String(user._id) });
    assert.ok(row);
    assert.strictEqual(row.actor_name, 'audit-admin');
    assert.strictEqual(JSON.stringify(row.toObject()).includes('demo1234'), false);
    assert.strictEqual(JSON.stringify(row.toObject()).includes('$2a$'), false);
});

test('a normal sign-in writes no admin audit row', async () => {
    const user = await createUser({ username: 'audit-cook' });

    const result = await signin('audit-cook', 'demo1234');

    assert.strictEqual(result.status, 200);
    assert.strictEqual(
        await collections.AuditLog.countDocuments({ action: 'admin.signin', target_id: String(user._id) }),
        0
    );
});
