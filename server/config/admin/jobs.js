const { collections } = require('../database/connection');
const { releaseMaintenance, releaseStaleMaintenance, setMaintenance, setRunningJob } = require('./maintenance');

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
        const timer = setTimeout(() => {
            const error = new Error('handler timed out');
            //The handler is not cancelled: the runner keeps the queue closed until it settles.
            error.timedOut = true;
            reject(error);
        }, ms);
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
    //A flag whose job already ended is retried on every tick; a failed write must not stop the tick.
    try {
        await releaseStaleMaintenance();
    } catch (error) {
        console.error(`Cannot clear a stale maintenance flag: ${error.message}`);
    }

    busy = true;
    let job;
    try {
        job = await collections.AdminJob.findOneAndUpdate(
            { status: 'queued' },
            { $set: { status: 'running', started_at: new Date() } },
            { sort: { created_at: 1 }, new: true }
        );
    } catch (error) {
        busy = false;
        throw error;
    }
    if (!job) {
        busy = false;
        return null;
    }

    setRunningJob(job._id);
    let handlerSettled = null;
    let timedOut = false;
    try {
        const handler = handlers[job.type];
        if (!handler) {
            throw new Error(`No handler for job type ${job.type}`);
        }
        const running = Promise.resolve(handler(job));
        //An abandoned handler may still reject; that rejection is not unhandled.
        handlerSettled = running.then(() => {}, () => {});
        job.detail = (await withTimeout(running, timeoutMs || timeoutFor(job.type))) || '';
        job.status = 'done';
    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        timedOut = error.timedOut === true;
    }

    job.finished_at = new Date();
    try {
        await job.save();
    } catch (error) {
        //The row stays running until the database recovers; the site must not stay blocked.
        console.error(`Cannot save job ${job._id} outcome: ${error.message}`);
    }

    //Only the job that switched the flag on releases it, and always runs.
    const release = async function() {
        try {
            await releaseMaintenance(job._id, `job ${job.type} ${job.status}`);
        } finally {
            setRunningJob(null);
            busy = false;
        }
    };

    //A timed-out handler is still writing: the next job waits and the flag stays on until it ends.
    if (timedOut && handlerSettled) {
        handlerSettled
            .then(() => release())
            .catch((error) => console.error(`Cannot release maintenance for job ${job._id}: ${error.message}`));
        return job;
    }

    await release();
    return job;
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
