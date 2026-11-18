const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let collections;
let jobs;
let maintenance;
let httpServer;
let baseUrl;

const get = async function(path, method = 'GET') {
    const response = await fetch(`${baseUrl}${path}`, { method });
    return { status: response.status, body: await response.json() };
};

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('jobs_test');

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;

    jobs = require('../config/admin/jobs');
    maintenance = require('../config/admin/maintenance');

    const app = express();
    app.use(maintenance.maintenanceMiddleware);
    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
    app.get('/api/auth/ping', (req, res) => res.json({ ok: true }));
    app.get('/api/admin/ping', (req, res) => res.json({ ok: true }));
    app.get('/api/dishes', (req, res) => res.json({ status: 'ok', data: [] }));
    app.post('/api/dishes', (req, res) => res.json({ isSuccess: true }));

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
    await collections.AdminJob.deleteMany({});
    await collections.Setting.deleteMany({});
});

test('maintenance is off by default', async () => {
    assert.strictEqual(await maintenance.isMaintenance(), false);
    assert.strictEqual((await get('/api/dishes')).status, 200);
});

test('the flag blocks public routes but not health, auth or admin', async () => {
    await maintenance.setMaintenance(true, 'reset running', { id: '64b000000000000000000001', name: 'boss' });

    const read = await get('/api/dishes');
    assert.strictEqual(read.status, 503);
    assert.match(read.body.message, /maintenance/i);

    const write = await get('/api/dishes', 'POST');
    assert.strictEqual(write.status, 503);

    assert.strictEqual((await get('/api/health')).status, 200);
    assert.strictEqual((await get('/api/auth/ping')).status, 200);
    assert.strictEqual((await get('/api/admin/ping')).status, 200);
});

test('clearing the flag restores public access', async () => {
    await maintenance.setMaintenance(true, 'reset running', null);
    assert.strictEqual((await get('/api/dishes')).status, 503);

    await maintenance.setMaintenance(false, 'reset done', null);

    assert.strictEqual(await maintenance.isMaintenance(), false);
    assert.strictEqual((await get('/api/dishes')).status, 200);
});

test('a queued job runs and ends done', async () => {
    jobs.registerHandler('test_type', async (job) => `ran ${job.type}`);

    const queued = await jobs.enqueueJob('test_type', { id: '64b000000000000000000001', name: 'boss' }, { note: 'x' });
    assert.strictEqual(queued.status, 'queued');
    assert.strictEqual(queued.actor_name, 'boss');
    assert.deepStrictEqual(queued.payload, { note: 'x' });

    const finished = await jobs.runNextJob();
    assert.strictEqual(finished.status, 'done');
    assert.ok(finished.started_at instanceof Date);
    assert.ok(finished.finished_at instanceof Date);
    assert.strictEqual(finished.detail, 'ran test_type');

    const stored = await collections.AdminJob.findById(queued._id);
    assert.strictEqual(stored.status, 'done');
});

test('a throwing handler marks the job failed and clears the flag', async () => {
    await maintenance.setMaintenance(true, 'reset running', null);
    jobs.registerHandler('boom_type', async () => {
        throw new Error('backup failed');
    });

    const queued = await jobs.enqueueJob('boom_type', null, {});
    const finished = await jobs.runNextJob();

    assert.strictEqual(finished.status, 'failed');
    assert.strictEqual(finished.error, 'backup failed');
    assert.ok(finished.finished_at instanceof Date);
    assert.strictEqual(await maintenance.isMaintenance(), false);

    const stored = await collections.AdminJob.findById(queued._id);
    assert.strictEqual(stored.status, 'failed');
});

test('an unknown job type fails instead of hanging', async () => {
    const queued = await jobs.enqueueJob('no_such_type', null, {});

    const finished = await jobs.runNextJob();

    assert.strictEqual(finished.status, 'failed');
    assert.match(finished.error, /no handler/i);
    assert.strictEqual((await collections.AdminJob.findById(queued._id)).status, 'failed');
});

test('the runner claims the oldest queued job first', async () => {
    jobs.registerHandler('order_type', async () => 'ok');

    const older = await jobs.enqueueJob('order_type', null, {});
    await collections.AdminJob.updateOne({ _id: older._id }, { $set: { created_at: new Date(Date.now() - 60000) } });
    const newer = await jobs.enqueueJob('order_type', null, {});

    const finished = await jobs.runNextJob();

    assert.strictEqual(String(finished._id), String(older._id));
    assert.strictEqual((await collections.AdminJob.findById(newer._id)).status, 'queued');
});

test('an empty queue returns null', async () => {
    assert.strictEqual(await jobs.runNextJob(), null);
});

test('a rejected status save still releases the maintenance flag', async () => {
    jobs.registerHandler('unsaveable_type', async () => {
        await maintenance.setMaintenance(true, 'reset running', null);
        return 'handled';
    });

    const originalSave = collections.AdminJob.prototype.save;
    collections.AdminJob.prototype.save = async function() {
        throw new Error('db down');
    };
    let finished;
    try {
        await jobs.enqueueJob('unsaveable_type', null, {});
        finished = await jobs.runNextJob();
    } finally {
        collections.AdminJob.prototype.save = originalSave;
    }

    assert.strictEqual(finished.status, 'done');
    assert.strictEqual(await maintenance.isMaintenance(), false);
    //Documented limit: the row cannot be written while the database rejects the save.
    assert.strictEqual((await collections.AdminJob.findById(finished._id)).status, 'running');
});

test('only the job that set maintenance clears the flag', async () => {
    //Job A owns the flag but is still running while job B is queued behind it.
    const owner = await collections.AdminJob.create({
        type: 'owner_type',
        status: 'running',
        created_at: new Date(Date.now() - 60000)
    });
    await maintenance.setMaintenance(true, 'reset running', null, owner._id);

    jobs.registerHandler('other_type', async () => 'other done');
    const other = await jobs.enqueueJob('other_type', null, {});

    const finishedOther = await jobs.runNextJob();
    assert.strictEqual(String(finishedOther._id), String(other._id));
    assert.strictEqual(await maintenance.isMaintenance(), true);

    //Job A now finishes and is the only one allowed to release the site.
    jobs.registerHandler('owner_type', async () => 'owner done');
    await collections.AdminJob.updateOne({ _id: owner._id }, { $set: { status: 'queued' } });

    const finishedOwner = await jobs.runNextJob();
    assert.strictEqual(String(finishedOwner._id), String(owner._id));
    assert.strictEqual(finishedOwner.status, 'done');
    assert.strictEqual(await maintenance.isMaintenance(), false);
});

test('a handler past its timeout fails with handler timed out', async () => {
    jobs.registerHandler('slow_type', () => new Promise((resolve) => setTimeout(() => resolve('late'), 200)));

    const queued = await jobs.enqueueJob('slow_type', null, {});
    const finished = await jobs.runNextJob(20);

    assert.strictEqual(finished.status, 'failed');
    assert.strictEqual(finished.error, 'handler timed out');
    assert.strictEqual(await maintenance.isMaintenance(), false);
    assert.strictEqual((await collections.AdminJob.findById(queued._id)).status, 'failed');
});

test('two concurrent runner calls run one job only', async () => {
    let started = 0;
    jobs.registerHandler('once_type', async () => {
        started += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'once done';
    });
    await jobs.enqueueJob('once_type', null, {});

    const results = await Promise.all([jobs.runNextJob(), jobs.runNextJob()]);

    assert.strictEqual(results.filter(Boolean).length, 1);
    assert.strictEqual(started, 1);
    assert.strictEqual((await collections.AdminJob.countDocuments({ status: 'queued' })), 0);
});

test('markInterruptedJobs fails stale queued and running rows only', async () => {
    const queued = await jobs.enqueueJob('stale_queued', null, {});
    const running = await jobs.enqueueJob('stale_running', null, {});
    await collections.AdminJob.updateOne({ _id: running._id }, { $set: { status: 'running', started_at: new Date() } });
    const done = await jobs.enqueueJob('finished', null, {});
    await collections.AdminJob.updateOne({ _id: done._id }, { $set: { status: 'done', finished_at: new Date() } });

    await jobs.markInterruptedJobs();

    const storedQueued = await collections.AdminJob.findById(queued._id);
    const storedRunning = await collections.AdminJob.findById(running._id);
    const storedDone = await collections.AdminJob.findById(done._id);

    assert.strictEqual(storedQueued.status, 'failed');
    assert.strictEqual(storedRunning.status, 'failed');
    assert.strictEqual(storedRunning.detail, 'server restarted');
    assert.strictEqual(storedDone.status, 'done');
});
