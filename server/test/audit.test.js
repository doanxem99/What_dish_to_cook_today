const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let collections;
let audit;

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('audit_test');

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;

    audit = require('../config/admin/audit');
});

after(async () => {
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});

beforeEach(async () => {
    await collections.AuditLog.deleteMany({});
});

test('recordAudit stores the full row', async () => {
    const before = Date.now();

    const row = await audit.recordAudit({
        actorId: '64b000000000000000000001',
        actorName: 'boss',
        action: 'user.role',
        targetType: 'user',
        targetId: '64b000000000000000000002',
        result: 'ok',
        detail: 'promoted to admin',
        ip: '127.0.0.1'
    });

    assert.strictEqual(String(row.actor_id), '64b000000000000000000001');
    assert.strictEqual(row.actor_name, 'boss');
    assert.strictEqual(row.action, 'user.role');
    assert.strictEqual(row.target_type, 'user');
    assert.strictEqual(row.target_id, '64b000000000000000000002');
    assert.strictEqual(row.result, 'ok');
    assert.strictEqual(row.detail, 'promoted to admin');
    assert.strictEqual(row.ip, '127.0.0.1');
    assert.ok(row.created_at instanceof Date);
    assert.ok(row.created_at.getTime() >= before);
});

test('missing optional fields are stored as empty values', async () => {
    const row = await audit.recordAudit({ action: 'admin.signin', result: 'ok' });

    assert.strictEqual(row.actor_id, null);
    assert.strictEqual(row.actor_name, '');
    assert.strictEqual(row.target_type, '');
    assert.strictEqual(row.target_id, '');
    assert.strictEqual(row.detail, '');
});

test('a second row does not overwrite the first', async () => {
    const first = await audit.recordAudit({
        actorName: 'boss',
        action: 'backup.create',
        result: 'ok'
    });
    await audit.recordAudit({
        actorName: 'boss',
        action: 'catalog.reset',
        result: 'ok'
    });

    assert.strictEqual(await collections.AuditLog.countDocuments({}), 2);
    const stored = await collections.AuditLog.findById(first._id);
    assert.strictEqual(stored.action, 'backup.create');
    assert.strictEqual(stored.result, 'ok');
});
