//ai_index job: one row per content write (coalesced), or a full rebuild.
const { collections } = require('../database/connection');
const embeddings = require('./embeddings');
const { readConfig } = require('./config');

const INDEX_TYPE = 'ai_index';

const targetFilter = (payload) => ({
    type: INDEX_TYPE,
    status: 'queued',
    'payload.full': { $ne: true },
    'payload.target_type': payload.target_type,
    'payload.target_id': payload.target_id
});

//One queued job per row: a second edit before the runner picks it up reuses the row.
const scheduleIndex = async (targetType, targetId, actor) => {
    const payload = { target_type: String(targetType), target_id: String(targetId) };
    const existing = await collections.AdminJob.findOne(targetFilter(payload));
    if (existing) return existing;
    const { enqueueJob } = require('../admin/jobs');
    return enqueueJob(INDEX_TYPE, actor, payload);
};

//A reset or restore invalidates every vector; one queued full job serves them all.
const scheduleFullIndex = async (actor) => {
    const existing = await collections.AdminJob.findOne({
        type: INDEX_TYPE,
        status: 'queued',
        'payload.full': true
    });
    if (existing) return existing;
    const { enqueueJob } = require('../admin/jobs');
    return enqueueJob(INDEX_TYPE, actor, { full: true });
};

//Content writes call this fire-and-forget. A missing AI setup or a queue error must not
//undo a write that already succeeded.
const scheduleIfEnabled = (targetType, targetId, actor) => {
    if (!readConfig().enabled) return Promise.resolve(null);
    return scheduleIndex(targetType, targetId, actor).catch((error) => {
        console.error(`Cannot enqueue ai_index for ${targetType} ${targetId}: ${error.message}`);
        return null;
    });
};

const scheduleFullIfEnabled = (actor) => {
    if (!readConfig().enabled) return Promise.resolve(null);
    return scheduleFullIndex(actor).catch((error) => {
        console.error(`Cannot enqueue full ai_index: ${error.message}`);
        return null;
    });
};

const runIndexJob = async (job) => {
    const payload = (job && job.payload) || {};
    const config = readConfig();
    const embedFn = embeddings.makeEmbedFn(config, undefined, 60000);
    const model = config.embedModel;
    if (payload.full === true) {
        const summary = await embeddings.rebuildIndex({ embedFn, model });
        return `indexed ${summary.dish} dish, ${summary.dish_post} dish_post, `
            + `${summary.ingredient} ingredient, ${summary.doc} doc passages, removed ${summary.deleted}`;
    }
    const result = await embeddings.syncTarget({
        targetType: payload.target_type,
        targetId: payload.target_id,
        embedFn,
        model
    });
    return `indexed ${result.target_type} ${result.target_id}: ${result.embedded} passage(s)`;
};

module.exports = {
    scheduleIndex,
    scheduleFullIndex,
    scheduleIfEnabled,
    scheduleFullIfEnabled,
    runIndexJob
};
