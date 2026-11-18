const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';

let mongod;
let collections;
let jobs;
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

const tokenFor = function(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: 60 });
};

const call = async function(path, token, method = 'GET', body) {
    const headers = {};
    if (token) {
        headers.cookie = `token=${token}`;
    }
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
};

const BACKUP_FILE = 'backup-20260101-000000.json.gz';

//The listing comes from the directory, so a test needs a real file with a valid name.
const writeBackupFixture = async function() {
    await fs.mkdir(process.env.BACKUP_DIR, { recursive: true });
    await fs.writeFile(path.join(process.env.BACKUP_DIR, BACKUP_FILE), 'fixture');
    return BACKUP_FILE.replace(/\.json\.gz$/, '');
};

//res.download runs its callback after the response, so an audit row can arrive just after.
const waitFor = async function(check, ms = 2000) {
    const until = Date.now() + ms;
    for (;;) {
        const value = await check();
        if (value) {
            return value;
        }
        if (Date.now() > until) {
            return null;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
};

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('admin_api_test');
    process.env.BACKUP_DIR = require('node:path').join(require('node:os').tmpdir(), `wdtct-admin-api-${process.pid}`);

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;
    jobs = require('../config/admin/jobs');

    const app = express();
    app.use(express.json());
    app.use(require('../config/body_error'));
    app.use(cookieParser());
    app.use('/api/health', require('../routes/api/health'));
    app.use('/api/admin', require('../routes/api/admin'));

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

beforeEach(async () => {
    await fs.rm(process.env.BACKUP_DIR, { recursive: true, force: true });
    await Promise.all([
        collections.User.deleteMany({}),
        collections.Role.deleteMany({}),
        collections.AdminJob.deleteMany({}),
        collections.AuditLog.deleteMany({}),
        collections.Setting.deleteMany({}),
        collections.Ingredient.deleteMany({}),
        collections.IngredientPost.deleteMany({}),
        collections.Dish.deleteMany({}),
        collections.DishPost.deleteMany({}),
        collections.Vote.deleteMany({}),
        collections.Comment.deleteMany({})
    ]);
});

test('public health is open and leaks no counts', async () => {
    const response = await call('/api/health');

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(Object.keys(response.body).sort(), ['status', 'uptime_s']);
    assert.strictEqual(response.body.status, 'ok');
    assert.strictEqual(typeof response.body.uptime_s, 'number');
});

test('an anonymous request gets 401 in the documented envelope', async () => {
    const response = await call('/api/admin/users');

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error.code, 'unauthorized');
    assert.match(response.body.error.message, /invalid/i);
});

test('a signed-in non-admin gets 403', async () => {
    const user = await createUser({ username: 'cook' });

    const response = await call('/api/admin/users', tokenFor(user));

    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.body.error.code, 'forbidden');
    assert.match(response.body.error.message, /admin/i);
});

test('a disabled admin gets 401', async () => {
    const admin = await createUser({ username: 'oldadmin', roles: ['user', 'admin'], is_disabled: true });

    const response = await call('/api/admin/users', tokenFor(admin));

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error.code, 'unauthorized');
});

test('the user list has roles but never a password hash', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    await createUser({ username: 'cook' });

    const response = await call('/api/admin/users?q=cook', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.total, 1);
    const row = response.body.rows[0];
    assert.strictEqual(row.username, 'cook');
    assert.deepStrictEqual(row.roles, ['user']);
    assert.strictEqual(row.password, undefined);
    assert.strictEqual(JSON.stringify(response.body).includes('$2a$'), false);
});

test('reset without the typed confirmation is refused', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });

    const missing = await call('/api/admin/reset', tokenFor(admin), 'POST', {});
    const wrong = await call('/api/admin/reset', tokenFor(admin), 'POST', { confirm: 'reset' });

    assert.strictEqual(missing.status, 400);
    assert.strictEqual(missing.body.error.code, 'invalid_confirm');
    assert.strictEqual(wrong.status, 400);
    assert.strictEqual(await collections.AdminJob.countDocuments({}), 0);
});

test('restore refuses an unknown backup id with 404', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });

    const wrongConfirm = await call('/api/admin/restore', tokenFor(admin), 'POST', {
        backup_id: 'backup-20260101-000000',
        confirm: 'no'
    });
    assert.strictEqual(wrongConfirm.status, 400);

    const unknown = await call('/api/admin/restore', tokenFor(admin), 'POST', {
        backup_id: 'backup-20260101-000000',
        confirm: 'RESTORE'
    });
    assert.strictEqual(unknown.status, 404);
    assert.strictEqual(unknown.body.error.code, 'not_found');
    assert.strictEqual(await collections.AdminJob.countDocuments({}), 0);
});

test('a reset is 409 while another job is queued', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });

    const backup = await call('/api/admin/backup', tokenFor(admin), 'POST', {});
    assert.strictEqual(backup.status, 202);
    assert.strictEqual(backup.body.type, 'backup');
    assert.strictEqual(backup.body.status, 'queued');

    const reset = await call('/api/admin/reset', tokenFor(admin), 'POST', { confirm: 'RESET' });

    assert.strictEqual(reset.status, 409);
    assert.strictEqual(reset.body.error.code, 'busy');
    assert.strictEqual(await collections.AdminJob.countDocuments({ type: 'reset' }), 0);
});

test('an admin cannot demote themselves', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    await createUser({ username: 'other', roles: ['user', 'admin'] });

    const response = await call(`/api/admin/users/${admin._id}/role`, tokenFor(admin), 'POST', { admin: false });

    assert.strictEqual(response.status, 409);
    assert.strictEqual(response.body.error.code, 'self');
    assert.deepStrictEqual((await collections.User.findById(admin._id)).roles.length, 2);
});

test('the only admin cannot lose the role and a second admin can be demoted', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const second = await createUser({ username: 'second', roles: ['user', 'admin'] });

    const selfDemote = await call(`/api/admin/users/${admin._id}/role`, tokenFor(admin), 'POST', { admin: false });
    assert.strictEqual(selfDemote.status, 409);
    assert.strictEqual(selfDemote.body.error.code, 'self');

    const demoted = await call(`/api/admin/users/${second._id}/role`, tokenFor(admin), 'POST', { admin: false });
    assert.strictEqual(demoted.status, 200);
    assert.deepStrictEqual(demoted.body.roles, ['user']);

    const stored = await collections.User.findById(second._id);
    assert.strictEqual(stored.roles.length, 1);
});


test('an admin cannot disable themselves', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    await createUser({ username: 'second', roles: ['user', 'admin'] });

    const response = await call(`/api/admin/users/${admin._id}/disabled`, tokenFor(admin), 'POST', { disabled: true });

    assert.strictEqual(response.status, 409);
    assert.strictEqual(response.body.error.code, 'self');
});

test('a concurrent demote and disable keep at least one enabled admin', async () => {
    const first = await createUser({ username: 'first-admin', roles: ['user', 'admin'] });
    const second = await createUser({ username: 'second-admin', roles: ['user', 'admin'] });

    //Each request is authorized while both are admins; the mutations then run one at a time.
    await Promise.all([
        call(`/api/admin/users/${second._id}/role`, tokenFor(first), 'POST', { admin: false }),
        call(`/api/admin/users/${first._id}/disabled`, tokenFor(second), 'POST', { disabled: true })
    ]);

    const adminRole = await collections.Role.findOne({ name: 'admin' });
    const enabledAdmins = await collections.User.countDocuments({
        roles: adminRole._id,
        is_disabled: { $ne: true }
    });
    assert.ok(enabledAdmins >= 1, `expected an enabled admin, found ${enabledAdmins}`);
});

test('the audit list paginates newest first and filters by action', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const start = Date.now();
    for (let index = 0; index < 30; index += 1) {
        await collections.AuditLog.create({
            actor_id: admin._id,
            actor_name: 'boss',
            action: index === 0 ? 'catalog.reset' : 'user.role',
            result: 'ok',
            created_at: new Date(start + index * 1000)
        });
    }

    const page = await call('/api/admin/audit?page=2', tokenFor(admin));
    assert.strictEqual(page.status, 200);
    assert.strictEqual(page.body.total, 30);
    assert.strictEqual(page.body.rows.length, 5);
    assert.strictEqual(page.body.rows[0].action, 'user.role');

    const filtered = await call('/api/admin/audit?action=catalog.reset', tokenFor(admin));
    assert.strictEqual(filtered.body.total, 1);
    assert.strictEqual(filtered.body.rows[0].action, 'catalog.reset');
});

test('the audit list resolves each target to a readable label and lists the actions', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const cook = await createUser({ username: 'cook', roles: ['user'] });
    const ingredient = await collections.Ingredient.create({ name: 'Beef', best_post_id: '' });
    const dish = await collections.Dish.create({ name: 'Pho' });
    const backupId = await writeBackupFixture();
    const job = await collections.AdminJob.create({ type: 'backup', status: 'done', created_at: new Date() });

    const start = Date.now();
    const targets = [
        { target_type: 'user', target_id: String(cook._id) },
        { target_type: 'ingredient', target_id: String(ingredient._id) },
        { target_type: 'dish', target_id: String(dish._id) },
        { target_type: 'backup', target_id: backupId },
        { target_type: 'job', target_id: String(job._id) },
        //A target that no longer exists keeps its raw id and the page falls back to it.
        { target_type: 'user', target_id: '64b00000000000000000dead' }
    ];
    for (const [index, target] of targets.entries()) {
        await collections.AuditLog.create({
            actor_name: 'boss',
            action: index % 2 === 0 ? 'user.role' : 'catalog.reset',
            result: 'ok',
            created_at: new Date(start + index * 1000),
            ...target
        });
    }

    const response = await call('/api/admin/audit', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.total, 6);
    assert.deepStrictEqual(response.body.actions, ['catalog.reset', 'user.role']);

    const labels = new Map(response.body.rows.map(row => [row.target_type + ':' + row.target_id, row.target_label]));
    assert.strictEqual(labels.get('user:' + cook._id), 'cook');
    assert.strictEqual(labels.get('ingredient:' + ingredient._id), 'Beef');
    assert.strictEqual(labels.get('dish:' + dish._id), 'Pho');
    assert.strictEqual(labels.get('backup:' + backupId), BACKUP_FILE);
    assert.strictEqual(labels.get('job:' + job._id), 'backup');
    assert.strictEqual(labels.get('user:64b00000000000000000dead'), '');
});

test('admin health reports probes without user secrets', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    await collections.Ingredient.create({ name: 'Beef', best_post_id: '' });

    const response = await call('/api/admin/health', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.database.ok, true);
    assert.strictEqual(typeof response.body.database.latency_ms, 'number');
    assert.strictEqual(response.body.counts.users, 1);
    assert.strictEqual(response.body.counts.ingredients, 1);
    assert.deepStrictEqual(
        Object.keys(response.body.counts).sort(),
        ['comments', 'dish_posts', 'dishes', 'ingredients', 'users', 'votes']
    );
    assert.strictEqual(typeof response.body.uptime_s, 'number');
    assert.strictEqual(response.body.ai.configured, false);
    assert.strictEqual(response.body.backup.dir_writable, true);
    //No user data in the health payload
    assert.strictEqual(JSON.stringify(response.body).includes('boss'), false);
});

test('an unreachable translation service is a failed probe, not a 500', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const saved = process.env.TRANSLATE_URL;
    process.env.TRANSLATE_URL = 'http://127.0.0.1:1/translate';
    try {
        const response = await call('/api/admin/health', tokenFor(admin));
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.translation.ok, false);
        //The page tells "not configured" from "configured but silent" with this boolean.
        assert.strictEqual(response.body.translation.configured, true);
    } finally {
        process.env.TRANSLATE_URL = saved;
    }
});

test('an unset translation service reports itself as not configured', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const saved = process.env.TRANSLATE_URL;
    delete process.env.TRANSLATE_URL;
    try {
        const response = await call('/api/admin/health', tokenFor(admin));
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.translation.ok, false);
        assert.strictEqual(response.body.translation.configured, false);
    } finally {
        process.env.TRANSLATE_URL = saved;
    }
});

test('recalc best post promotes the post with the most points', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const ingredient = await collections.Ingredient.create({ name: 'Beef', best_post_id: 'stale' });
    const low = await collections.IngredientPost.create({
        ingredient_id: String(ingredient._id), points: 1, unique_id: 'a'
    });
    const high = await collections.IngredientPost.create({
        ingredient_id: String(ingredient._id), points: 9, unique_id: 'b'
    });

    const queued = await call('/api/admin/jobs/recalc-best-post', tokenFor(admin), 'POST', {
        ingredient_id: String(ingredient._id)
    });
    assert.strictEqual(queued.status, 202);
    assert.strictEqual(queued.body.type, 'recalc_best_post');

    const finished = await jobs.runNextJob();
    assert.strictEqual(finished.status, 'done');

    const stored = await collections.Ingredient.findById(ingredient._id);
    assert.strictEqual(stored.best_post_id, String(high._id));
    assert.strictEqual((await collections.IngredientPost.findById(high._id)).is_best_post, true);
    assert.strictEqual((await collections.IngredientPost.findById(low._id)).is_best_post, false);

    const audit = await collections.AuditLog.findOne({ action: 'job.recalc_best_post' });
    assert.ok(audit);
    assert.strictEqual(audit.actor_name, 'boss');
});

test('recalc refuses a missing or unknown ingredient', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });

    const missing = await call('/api/admin/jobs/recalc-best-post', tokenFor(admin), 'POST', {});
    assert.strictEqual(missing.status, 400);

    const unknown = await call('/api/admin/jobs/recalc-best-post', tokenFor(admin), 'POST', {
        ingredient_id: '64b000000000000000000001'
    });
    assert.strictEqual(unknown.status, 404);
});

test('a temporary password is returned once and stored hashed', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const user = await createUser({ username: 'cook' });

    const response = await call(`/api/admin/users/${user._id}/password`, tokenFor(admin), 'POST', {});

    assert.strictEqual(response.status, 200);
    assert.strictEqual(typeof response.body.password, 'string');
    assert.ok(response.body.password.length >= 8);
    assert.strictEqual(response.body.user.must_change_password, true);
    assert.strictEqual(response.body.user.password, undefined);

    const stored = await collections.User.findById(user._id);
    assert.notStrictEqual(stored.password, response.body.password);
    assert.strictEqual(bcrypt.compareSync(response.body.password, stored.password), true);

    const audit = await collections.AuditLog.findOne({ action: 'user.password' });
    assert.ok(audit);
    assert.strictEqual(audit.detail.includes(response.body.password), false);
});

test('backup listing is admin-only', async () => {
    const response = await call('/api/admin/backups');

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error.code, 'unauthorized');
});

test('a backup download streams the file and audits the successful stream', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const id = await writeBackupFixture();

    const response = await fetch(`${baseUrl}/api/admin/backups/${id}`, {
        headers: { cookie: `token=${tokenFor(admin)}` }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(await response.text(), 'fixture');
    const audit = await waitFor(() => collections.AuditLog.findOne({ action: 'backup.download', target_id: id }));
    assert.ok(audit);
    assert.strictEqual(audit.result, 'ok');
});

test('restore is 409 while another job is queued', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const id = await writeBackupFixture();
    await collections.AdminJob.create({ type: 'backup', status: 'queued', created_at: new Date() });

    const response = await call('/api/admin/restore', tokenFor(admin), 'POST', {
        backup_id: id,
        confirm: 'RESTORE'
    });

    assert.strictEqual(response.status, 409);
    assert.strictEqual(response.body.error.code, 'busy');
    assert.strictEqual(await collections.AdminJob.countDocuments({ type: 'restore' }), 0);
});

test('admin health reports the maintenance flag from settings', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const updated = new Date('2026-02-03T04:05:06.000Z');
    //The banner names the job that owns the flag and links to it.
    const ownerJobId = new (require('mongoose').Types.ObjectId)();
    await collections.Setting.create({
        key: 'maintenance',
        enabled: true,
        reason: 'restore',
        owner_job_id: ownerJobId,
        updated_at: updated
    });

    const response = await call('/api/admin/health', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.maintenance.on, true);
    assert.strictEqual(response.body.maintenance.reason, 'restore');
    assert.strictEqual(response.body.maintenance.updated_at, updated.toISOString());
    assert.strictEqual(response.body.maintenance.job_id, String(ownerJobId));
});

test('admin health reports no maintenance job when the flag has no owner', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    await collections.Setting.create({ key: 'maintenance', enabled: true, reason: 'setup' });

    const response = await call('/api/admin/health', tokenFor(admin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.maintenance.job_id, null);
});

test('a read-only backup directory is not reported writable', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const originalDir = process.env.BACKUP_DIR;
    //A fresh directory misses the successful-probe cache.
    process.env.BACKUP_DIR = path.join(require('node:os').tmpdir(), `wdtct-readonly-${process.pid}-${Date.now()}`);
    const original = fs.writeFile;
    fs.writeFile = async function(target, ...rest) {
        if (String(target).includes('.probe-')) {
            const error = new Error('EACCES: permission denied');
            error.code = 'EACCES';
            throw error;
        }
        return original.call(this, target, ...rest);
    };
    try {
        const response = await call('/api/admin/health', tokenFor(admin));
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.backup.dir_writable, false);
    } finally {
        fs.writeFile = original;
        if (originalDir === undefined) {
            delete process.env.BACKUP_DIR;
        } else {
            process.env.BACKUP_DIR = originalDir;
        }
    }
});

test('demoting a user who is not an admin writes nothing', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const cook = await createUser({ username: 'cook' });
    const originalSave = collections.User.prototype.save;
    let saves = 0;
    collections.User.prototype.save = function(...args) {
        saves += 1;
        return originalSave.apply(this, args);
    };
    try {
        const response = await call(`/api/admin/users/${cook._id}/role`, tokenFor(admin), 'POST', { admin: false });
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body.roles, ['user']);
        assert.strictEqual(saves, 0);
    } finally {
        collections.User.prototype.save = originalSave;
    }
    assert.strictEqual(await collections.AuditLog.countDocuments({ action: 'user.role' }), 0);
});

test('a demotion that empties the admins is rolled back', async () => {
    const admin = await createUser({ username: 'boss', roles: ['user', 'admin'] });
    const second = await createUser({ username: 'second', roles: ['user', 'admin'] });
    const original = collections.User.countDocuments;
    let calls = 0;
    collections.User.countDocuments = async function(filter) {
        //First check sees a healthy pair; the post-update recount sees the race result.
        if (filter && filter.roles) {
            calls += 1;
            return calls === 1 ? 2 : 0;
        }
        return original.call(this, filter);
    };
    try {
        const response = await call(`/api/admin/users/${second._id}/role`, tokenFor(admin), 'POST', { admin: false });
        assert.strictEqual(response.status, 409);
        assert.strictEqual(response.body.error.code, 'last_admin');
    } finally {
        collections.User.countDocuments = original;
    }

    const stored = await collections.User.findById(second._id);
    assert.strictEqual(stored.roles.length, 2);
    assert.strictEqual(await collections.AuditLog.countDocuments({ action: 'user.role' }), 0);
});

test('a malformed JSON body answers the documented error envelope', async () => {
    const response = await fetch(`${baseUrl}/api/admin/reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json'
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'invalid_json');
    assert.strictEqual(typeof body.error.message, 'string');
});
