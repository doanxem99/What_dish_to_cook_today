const { collections } = require('../database/connection');
const { releaseMaintenance, setMaintenance, setRunningJob } = require('./maintenance');

//Type -> handler(job) returning a detail string. Task 4 registers the destructive operations.
const handlers = {};

const registerHandler = function(type, handler) {
    handlers[type] = handler;
};

//A handler that never settles must not hold the queue; a restore rewrites whole collections.
const DEFAULT_HANDLER_TIMEOUT = 60 * 1000;
const HANDLER_TIMEOUTS = { restore: 10 * 60 * 1000 };

const timeoutFor = function(type) {
    return HANDLER_TIMEOUTS[type] || DEFAULT_HANDLER_TIMEOUT;
};

const withTimeout = function(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('handler timed out')), ms);
        timer.unref();
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
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
//timeoutMs overrides the per-type bound, which is what the tests use.
const runNextJob = async function(timeoutMs) {
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
            setRunningJob(job._id);
            job.detail = (await withTimeout(handler(job), timeoutMs || timeoutFor(job.type))) || '';
            job.status = 'done';
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
        } finally {
            setRunningJob(null);
            job.finished_at = new Date();
            try {
                await job.save();
            } catch (error) {
                //The row stays running until the database recovers; the site must not stay blocked.
                console.error(`Cannot save job ${job._id} outcome: ${error.message}`);
            } finally {
                //Only the job that switched the flag on releases it, and always runs.
                await releaseMaintenance(job._id, `job ${job.type} ${job.status}`);
            }
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

//Ingredient-only in v1; dishes are out of scope. Same rule as the desktop repair tool.
registerHandler('recalc_best_post', async (job) => {
    const ingredientId = String((job.payload && job.payload.ingredient_id) || '');
    const ingredient = await collections.Ingredient.findById(ingredientId);
    if (!ingredient) {
        throw new Error(`Ingredient ${ingredientId} not found`);
    }
    const posts = await collections.IngredientPost.find({ ingredient_id: ingredientId }).sort({ points: -1 }).limit(1);
    if (posts.length === 0) {
        throw new Error(`Ingredient ${ingredientId} has no post to vote`);
    }
    const best = posts[0];
    await collections.IngredientPost.updateMany(
        { ingredient_id: ingredientId },
        { $set: { is_best_post: false } }
    );
    await collections.IngredientPost.updateOne({ _id: best._id }, { $set: { is_best_post: true } });
    await collections.Ingredient.updateOne({ _id: ingredient._id }, { $set: { best_post_id: String(best._id) } });
    return `best post ${best._id} for ingredient ${ingredientId}`;
});

module.exports = { enqueueJob, runNextJob, markInterruptedJobs, registerHandler };
