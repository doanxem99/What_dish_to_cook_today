const { collections } = require('../database/connection');
const { setMaintenance } = require('./maintenance');

//Type -> handler(job) returning a detail string. Task 4 registers the destructive operations.
const handlers = {};

const registerHandler = function(type, handler) {
    handlers[type] = handler;
};

const actorFields = function(actor) {
    const source = actor || {};
    return {
        actor_id: source.id || source._id || null,
        actor_name: source.name || source.username || ''
    };
};

const enqueueJob = async function(type, actor, payload) {
    return collections.AdminJob.create({
        type,
        status: 'queued',
        ...actorFields(actor),
        payload: payload || {},
        created_at: new Date()
    });
};

//Concurrency 1: a call while a job runs is a no-op, the interval calls again later.
let busy = false;

//Claims one queued job atomically, runs it and records the outcome.
const runNextJob = async function() {
    if (busy) {
        return null;
    }
    busy = true;
    try {
        const job = await collections.AdminJob.findOneAndUpdate(
            { status: 'queued' },
            { $set: { status: 'running', started_at: new Date() } },
            { sort: { created_at: 1 }, new: true }
        );
        if (!job) {
            return null;
        }

        try {
            const handler = handlers[job.type];
            if (!handler) {
                throw new Error(`No handler for job type ${job.type}`);
            }
            job.detail = (await handler(job)) || '';
            job.status = 'done';
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
        } finally {
            job.finished_at = new Date();
            await job.save();
            //A destructive job owns the flag; the job ending always releases the site
            await setMaintenance(false, `job ${job.type} ${job.status}`, null);
        }
        return job;
    } finally {
        busy = false;
    }
};

//Boot recovery: a queued or running row cannot survive a restart. No auto-retry.
const markInterruptedJobs = async function() {
    const result = await collections.AdminJob.updateMany(
        { status: { $in: ['queued', 'running'] } },
        { $set: { status: 'failed', detail: 'server restarted', finished_at: new Date() } }
    );
    //The interrupted job never released the flag, so the site would stay blocked
    await setMaintenance(false, 'server restarted', null);
    return result.modifiedCount;
};

//Destructive operations run through the queue; their detail names the backup file they wrote.
const backups = require('./backups');
const resetOps = require('./reset');

const jobActor = function(job) {
    return { id: job.actor_id, name: job.actor_name };
};

registerHandler('backup', async (job) => {
    const backup = await backups.createBackup({ trigger: 'job', actor: jobActor(job) });
    return `backup ${backup.file}`;
});
registerHandler('reset', async (job) => resetOps.resetCatalog(jobActor(job)));
registerHandler('restore', async (job) => resetOps.restoreBackup(job.payload && job.payload.id, jobActor(job)));

module.exports = { enqueueJob, runNextJob, markInterruptedJobs, registerHandler };
