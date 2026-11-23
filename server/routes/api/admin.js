const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();

const database = require('../../config/database/connection');
const { requireAdmin } = require('../../config/admin/require_admin');
const jobs = require('../../config/admin/jobs');
const backups = require('../../config/admin/backups');
const { recordAudit } = require('../../config/admin/audit');
const aiConfig = require('../../config/ai/config');
const aiChat = require('../../config/ai/chat');
const indexJob = require('../../config/ai/index_job');
const { version } = require('../../package.json');

const { collections, mongoose } = database;

const PAGE_SIZE = 25;
//The page poll asks every 15 s; the service probe runs at most twice a minute.
const TRANSLATION_CACHE_MS = 30 * 1000;
//A successful backup-dir probe is trusted for a minute; a failure is retried on the next poll.
const BACKUP_PROBE_CACHE_MS = 60 * 1000;

const fail = function(res, status, code, message) {
    return res.status(status).send({ error: { code, message } });
};

//The shared auth middleware answers with {message}; this API documents one error envelope.
const errorEnvelope = function(req, res, next) {
    const send = res.send.bind(res);
    res.send = function(body) {
        if (res.statusCode >= 400 && body && typeof body === 'object' && body.message && !body.error) {
            const code = res.statusCode === 401 ? 'unauthorized' : 'forbidden';
            return send({ error: { code, message: body.message } });
        }
        return send(body);
    };
    next();
};

//A rejected promise becomes the documented error body instead of a raw stack.
const wrap = function(handler) {
    return function(req, res, next) {
        Promise.resolve(handler(req, res, next)).catch((error) => {
            if (!res.headersSent) {
                fail(res, error.status || 500, 'server_error', error.message);
            }
        });
    };
};

const actorOf = function(req) {
    const user = req.current_user;
    return { id: user._id, name: user.username || user.email };
};

const audit = function(req, action, targetType, targetId, detail) {
    return recordAudit({
        actorId: req.current_user._id,
        actorName: req.current_user.username || req.current_user.email || '',
        action,
        targetType,
        targetId: targetId ? String(targetId) : '',
        result: 'ok',
        detail: detail || '',
        ip: req.ip || ''
    });
};

const escapeRegex = function(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const pageOf = function(value) {
    const page = Number.parseInt(value, 10);
    return Number.isInteger(page) && page > 0 ? page : 1;
};

const findUser = async function(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }
    return collections.User.findById(id);
};

const roleNamesById = async function() {
    const roles = await collections.Role.find({});
    const names = new Map();
    for (const role of roles) {
        names.set(String(role._id), role.name);
    }
    return names;
};

const userRow = function(user, names) {
    const roles = names || new Map();
    return {
        id: String(user._id),
        username: user.username || '',
        email: user.email || '',
        created_at: user.created_at || null,
        is_disabled: user.is_disabled === true,
        must_change_password: user.must_change_password === true,
        ai_disabled: user.ai_disabled === true,
        ai_daily_limit: user.ai_daily_limit === null || user.ai_daily_limit === undefined
            ? null
            : user.ai_daily_limit,
        roles: (user.roles || []).map(id => roles.get(String(id))).filter(Boolean)
    };
};

const userRowWithRoles = async function(user) {
    return userRow(user, await roleNamesById());
};

const isAdmin = function(user, adminRoleId) {
    return (user.roles || []).some(id => String(id) === String(adminRoleId));
};

const enabledAdminCount = async function(adminRoleId) {
    return collections.User.countDocuments({ roles: adminRoleId, is_disabled: { $ne: true } });
};

const jobIsBusy = async function() {
    return (await collections.AdminJob.countDocuments({ status: { $in: ['queued', 'running'] } })) > 0;
};

//Role and disabled changes are read-then-write checks of the last enabled admin, so they run one
//at a time. A single process is enough here; several instances would need a database transaction.
let adminMutation = Promise.resolve();
const serializeAdminMutation = function(req, res, next) {
    const previous = adminMutation;
    let release;
    adminMutation = new Promise((resolve) => {
        release = resolve;
    });
    const finish = function() {
        res.off('finish', finish);
        res.off('close', finish);
        release();
    };
    previous.then(() => {
        res.once('finish', finish);
        res.once('close', finish);
        next();
    });
};

//requireAdmin guards the whole router, including the GETs, before any route runs.
router.use(errorEnvelope, requireAdmin);

//------------ Health

const translationBase = function() {
    const url = String(process.env.TRANSLATE_URL || '').trim();
    if (!url) {
        return '';
    }
    return url.replace(/\/translate\/?$/, '').replace(/\/+$/, '');
};

let translationCache = { base: null, at: 0, value: null };

const probeTranslation = async function() {
    const base = translationBase();
    if (!base) {
        return { ok: false, configured: false, error: 'TRANSLATE_URL is not set' };
    }
    if (translationCache.base === base && Date.now() - translationCache.at < TRANSLATION_CACHE_MS) {
        return translationCache.value;
    }
    let value;
    try {
        const response = await fetch(`${base}/languages`, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) {
            value = { ok: false, configured: true, error: `translation answered ${response.status}` };
        } else {
            const languages = await response.json();
            value = { ok: true, configured: true, languages: Array.isArray(languages) ? languages.length : 0 };
        }
    } catch (error) {
        value = { ok: false, configured: true, error: error.message };
    }
    translationCache = { base, at: Date.now(), value };
    return value;
};

let backupProbeCache = { dir: null, at: 0, value: null };

const probeBackupDir = async function() {
    const dir = backups.backupDir();
    if (backupProbeCache.value && backupProbeCache.dir === dir
        && Date.now() - backupProbeCache.at < BACKUP_PROBE_CACHE_MS) {
        return backupProbeCache.value;
    }
    const probe = path.join(dir, `.probe-${crypto.randomBytes(6).toString('hex')}`);
    try {
        await fs.mkdir(dir, { recursive: true });
        //Actually create and remove a file: a read-only directory still passes an access check.
        await fs.writeFile(probe, '');
        await fs.unlink(probe);
        const value = { dir_writable: true, dir };
        backupProbeCache = { dir, at: Date.now(), value };
        return value;
    } catch (error) {
        backupProbeCache = { dir: null, at: 0, value: null };
        await fs.unlink(probe).catch(() => {});
        return { dir_writable: false, dir, error: error.message };
    }
};

router.get('/health', wrap(async function(req, res) {
    const startedAt = Date.now();
    let databaseProbe;
    try {
        await mongoose.connection.db.admin().command({ ping: 1 });
        databaseProbe = { ok: true, latency_ms: Date.now() - startedAt };
    } catch (error) {
        databaseProbe = { ok: false, latency_ms: Date.now() - startedAt, error: error.message };
    }

    const [
        users, ingredients, dishes, dish_posts, comments, votes,
        translation, backupDir, lastBackupRows, lastReset, maintenanceDoc,
        aiEnabled, aiBudgetReached
    ] = await Promise.all([
        collections.User.countDocuments({}),
        collections.Ingredient.countDocuments({}),
        collections.Dish.countDocuments({}),
        collections.DishPost.countDocuments({}),
        collections.Comment.countDocuments({}),
        collections.Vote.countDocuments({}),
        probeTranslation(),
        probeBackupDir(),
        backups.listBackups(),
        collections.AdminJob.findOne({ type: 'reset' }).sort({ created_at: -1 }),
        collections.Setting.findOne({ key: 'maintenance' }),
        aiConfig.isAiRuntimeEnabled().catch(() => false),
        aiChat.isMonthlyBudgetReached(aiConfig.readConfig()).catch(() => false)
    ]);

    const aiSettings = aiConfig.readConfig();

    const lastBackup = lastBackupRows.length > 0 ? lastBackupRows[0] : null;

    return res.status(200).send({
        version,
        uptime_s: Math.round(process.uptime()),
        database: databaseProbe,
        counts: { users, ingredients, dishes, dish_posts, comments, votes },
        translation,
        //Counts only; no prompt or reply text passes through this route.
        ai: {
            configured: aiSettings.enabled,
            enabled: aiEnabled,
            budget_reached: aiBudgetReached,
            provider: aiSettings.provider,
            model: aiSettings.model
        },
        backup: {
            dir_writable: backupDir.dir_writable,
            dir: backupDir.dir,
            last: lastBackup,
            error: backupDir.error
        },
        maintenance: {
            on: Boolean(maintenanceDoc && maintenanceDoc.enabled),
            reason: maintenanceDoc ? maintenanceDoc.reason || '' : '',
            //The banner names the job that owns the flag and links to it.
            job_id: maintenanceDoc && maintenanceDoc.owner_job_id ? String(maintenanceDoc.owner_job_id) : null,
            updated_at: maintenanceDoc ? maintenanceDoc.updated_at || null : null
        },
        last_reset: lastReset ? {
            id: String(lastReset._id),
            status: lastReset.status,
            actor_name: lastReset.actor_name || '',
            created_at: lastReset.created_at || null,
            finished_at: lastReset.finished_at || null,
            detail: lastReset.detail || ''
        } : null
    });
}));

//------------ Jobs

router.get('/jobs', wrap(async function(req, res) {
    const page = pageOf(req.query.page);
    const filter = {};
    if (req.query.type) {
        filter.type = String(req.query.type);
    }
    if (req.query.status) {
        filter.status = String(req.query.status);
    }

    const [rows, total] = await Promise.all([
        collections.AdminJob.find(filter).sort({ created_at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
        collections.AdminJob.countDocuments(filter)
    ]);

    return res.status(200).send({ rows, total, page });
}));

router.post('/jobs/recalc-best-post', wrap(async function(req, res) {
    const ingredientId = String(req.body.ingredient_id || '');
    if (!mongoose.Types.ObjectId.isValid(ingredientId)) {
        return fail(res, 400, 'invalid', 'ingredient_id must be a database id');
    }
    const ingredient = await collections.Ingredient.findById(ingredientId);
    if (!ingredient) {
        return fail(res, 404, 'not_found', 'Ingredient not found');
    }

    const job = await jobs.enqueueJob('recalc_best_post', actorOf(req), { ingredient_id: ingredientId });
    await audit(req, 'job.recalc_best_post', 'ingredient', ingredientId, `job ${job._id}`);
    return res.status(202).send(job);
}));

//------------ AI usage

const startOfUtcMonth = function() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const roundUsd = function(value) {
    return Math.round((Number(value) || 0) * 1e6) / 1e6;
};

//Counts, tokens and latency only. Message text is never selected or grouped here.
router.get('/ai/usage', wrap(async function(req, res) {
    const config = aiConfig.readConfig();
    const monthStart = startOfUtcMonth();

    const [totalsRows, dayRows, monthRows, recentRows, enabled] = await Promise.all([
        collections.AiCall.aggregate([{
            $group: {
                _id: null,
                calls: { $sum: 1 },
                tokens_in: { $sum: '$tokens_in' },
                tokens_out: { $sum: '$tokens_out' },
                cost_estimate: { $sum: '$cost_estimate' },
                errors: { $sum: { $cond: [{ $ne: ['$status', 'ok'] }, 1, 0] } }
            }
        }]),
        collections.AiCall.aggregate([
            {
                $group: {
                    _id: {
                        day: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
                        model: '$model'
                    },
                    calls: { $sum: 1 },
                    tokens_in: { $sum: '$tokens_in' },
                    tokens_out: { $sum: '$tokens_out' },
                    cost_estimate: { $sum: '$cost_estimate' },
                    errors: { $sum: { $cond: [{ $ne: ['$status', 'ok'] }, 1, 0] } },
                    avg_latency_ms: { $avg: '$latency_ms' }
                }
            },
            { $sort: { '_id.day': -1, '_id.model': 1 } }
        ]),
        collections.AiCall.aggregate([
            { $match: { created_at: { $gte: monthStart } } },
            { $group: { _id: null, cost: { $sum: '$cost_estimate' } } }
        ]),
        collections.AiCall.find({})
            .sort({ created_at: -1 })
            .limit(50)
            .select('provider model mode capability latency_ms tokens_in tokens_out cost_estimate status error_code created_at')
            .lean(),
        aiConfig.isAiRuntimeEnabled().catch(() => false)
    ]);

    const totalsRow = totalsRows[0] || {};
    const monthCost = monthRows.length > 0 ? Number(monthRows[0].cost) || 0 : 0;

    return res.status(200).send({
        configured: config.enabled,
        enabled,
        budget_usd: config.monthlyBudgetUsd,
        month_cost_estimate: roundUsd(monthCost),
        budget_reached: monthCost >= config.monthlyBudgetUsd,
        totals: {
            calls: totalsRow.calls || 0,
            tokens_in: totalsRow.tokens_in || 0,
            tokens_out: totalsRow.tokens_out || 0,
            cost_estimate: roundUsd(totalsRow.cost_estimate),
            errors: totalsRow.errors || 0
        },
        by_day: dayRows.map(row => ({
            day: row._id.day,
            model: row._id.model || '',
            calls: row.calls || 0,
            tokens_in: row.tokens_in || 0,
            tokens_out: row.tokens_out || 0,
            cost_estimate: roundUsd(row.cost_estimate),
            errors: row.errors || 0,
            avg_latency_ms: Math.round(row.avg_latency_ms || 0)
        })),
        recent: recentRows.map(row => ({
            id: String(row._id),
            created_at: row.created_at || null,
            provider: row.provider || '',
            model: row.model || '',
            mode: row.mode || '',
            capability: row.capability || '',
            latency_ms: row.latency_ms || 0,
            tokens_in: row.tokens_in || 0,
            tokens_out: row.tokens_out || 0,
            cost_estimate: roundUsd(row.cost_estimate),
            status: row.status || '',
            error_code: row.error_code || ''
        }))
    });
}));

router.post('/ai/enabled', wrap(async function(req, res) {
    if (typeof req.body.enabled !== 'boolean') {
        return fail(res, 400, 'invalid', 'enabled must be true or false');
    }
    const actor = actorOf(req);
    await collections.Setting.findOneAndUpdate(
        { key: 'ai_enabled' },
        {
            $set: {
                enabled: req.body.enabled,
                actor_id: actor.id,
                actor_name: actor.name,
                updated_at: new Date()
            }
        },
        { upsert: true, new: true }
    );
    await audit(req, 'ai.enabled', 'setting', 'ai_enabled', req.body.enabled ? 'AI enabled' : 'AI disabled');
    return res.status(200).send({ enabled: req.body.enabled });
}));

router.post('/ai/users/:id', wrap(async function(req, res) {
    const body = req.body || {};
    const hasDisabled = body.disabled !== undefined;
    const hasLimit = Object.prototype.hasOwnProperty.call(body, 'daily_limit');
    if (!hasDisabled && !hasLimit) {
        return fail(res, 400, 'invalid', 'disabled or daily_limit is required');
    }
    if (hasDisabled && typeof body.disabled !== 'boolean') {
        return fail(res, 400, 'invalid', 'disabled must be true or false');
    }
    if (hasLimit && body.daily_limit !== null
        && (!Number.isInteger(body.daily_limit) || body.daily_limit < 0 || body.daily_limit > 1000)) {
        return fail(res, 400, 'invalid', 'daily_limit must be null or an integer from 0 to 1000');
    }
    const user = await findUser(req.params.id);
    if (!user) {
        return fail(res, 404, 'not_found', 'User not found');
    }

    if (hasDisabled) user.ai_disabled = body.disabled;
    if (hasLimit) user.ai_daily_limit = body.daily_limit;
    await user.save();

    //No message text: only the switch state and the numeric limit.
    const detail = [
        hasDisabled ? `ai ${body.disabled ? 'disabled' : 'enabled'}` : '',
        hasLimit ? `daily limit ${body.daily_limit === null ? 'default' : body.daily_limit}` : ''
    ].filter(Boolean).join(', ');
    await audit(req, 'user.ai', 'user', user._id, detail);
    return res.status(200).send(await userRowWithRoles(user));
}));

router.post('/ai/reindex', wrap(async function(req, res) {
    const job = await indexJob.scheduleFullIndex(actorOf(req));
    await audit(req, 'job.ai_index', 'job', job._id, 'full index rebuild queued');
    return res.status(202).send(job);
}));

//------------ Backups

router.post('/backup', wrap(async function(req, res) {
    const job = await jobs.enqueueJob('backup', actorOf(req), {});
    await audit(req, 'job.backup', 'job', job._id, 'backup queued');
    return res.status(202).send(job);
}));

router.get('/backups', wrap(async function(req, res) {
    const rows = await backups.listBackups();
    return res.status(200).send({ rows, total: rows.length, page: 1 });
}));

router.get('/backups/:id', wrap(async function(req, res) {
    //Resolved against the known listing: no path ever comes from the request.
    const rows = await backups.listBackups();
    const row = rows.find(candidate => candidate.id === req.params.id);
    if (!row) {
        return fail(res, 404, 'not_found', 'Backup not found');
    }
    return res.download(path.join(backups.backupDir(), row.file), row.file, function(error) {
        //The row records the outcome, so a broken stream is not reported as a download.
        if (error) {
            recordAudit({
                actorId: req.current_user._id,
                actorName: req.current_user.username || req.current_user.email || '',
                action: 'backup.download',
                targetType: 'backup',
                targetId: row.id,
                result: 'failed',
                detail: error.message,
                ip: req.ip || ''
            }).catch(() => {});
            if (!res.headersSent) {
                fail(res, 500, 'download_failed', error.message);
            }
            return;
        }
        audit(req, 'backup.download', 'backup', row.id, row.file).catch(() => {});
    });
}));

router.post('/restore', wrap(async function(req, res) {
    const backupId = String(req.body.backup_id || '');
    if (req.body.confirm !== 'RESTORE') {
        return fail(res, 400, 'invalid_confirm', 'Type RESTORE to confirm');
    }
    if (!backupId) {
        return fail(res, 400, 'invalid_id', 'backup_id is required');
    }
    const rows = await backups.listBackups();
    if (!rows.some(candidate => candidate.id === backupId)) {
        return fail(res, 404, 'not_found', 'Backup not found');
    }
    if (await jobIsBusy()) {
        return fail(res, 409, 'busy', 'Another job is running');
    }

    const job = await jobs.enqueueJob('restore', actorOf(req), { id: backupId });
    await audit(req, 'job.restore', 'backup', backupId, `job ${job._id}`);
    return res.status(202).send(job);
}));

router.post('/reset', wrap(async function(req, res) {
    if (req.body.confirm !== 'RESET') {
        return fail(res, 400, 'invalid_confirm', 'Type RESET to confirm');
    }
    if (await jobIsBusy()) {
        return fail(res, 409, 'busy', 'Another job is running');
    }

    const job = await jobs.enqueueJob('reset', actorOf(req), {});
    await audit(req, 'job.reset', 'job', job._id, 'catalog reset queued');
    return res.status(202).send(job);
}));

//------------ Users

router.get('/users', wrap(async function(req, res) {
    const page = pageOf(req.query.page);
    const query = String(req.query.q || '').trim();
    const filter = {};
    if (query) {
        const pattern = new RegExp(escapeRegex(query), 'i');
        filter.$or = [{ username: pattern }, { email: pattern }];
    }

    const [users, total, names] = await Promise.all([
        collections.User.find(filter).sort({ username: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
        collections.User.countDocuments(filter),
        roleNamesById()
    ]);

    return res.status(200).send({ rows: users.map(user => userRow(user, names)), total, page });
}));

router.post('/users/:id/role', serializeAdminMutation, wrap(async function(req, res) {
    if (typeof req.body.admin !== 'boolean') {
        return fail(res, 400, 'invalid', 'admin must be true or false');
    }
    const user = await findUser(req.params.id);
    if (!user) {
        return fail(res, 404, 'not_found', 'User not found');
    }

    const adminRole = await collections.Role.findOneAndUpdate(
        { name: 'admin' },
        { $setOnInsert: { name: 'admin', description: 'Admin role' } },
        { new: true, upsert: true }
    );
    const wasAdmin = isAdmin(user, adminRole._id);

    //Nothing to change: no save and no audit row for a no-op.
    if (req.body.admin === wasAdmin) {
        return res.status(200).send(await userRowWithRoles(user));
    }

    if (!req.body.admin) {
        if (String(user._id) === String(req.current_user._id)) {
            return fail(res, 409, 'self', 'An admin cannot demote themselves');
        }
        if ((await enabledAdminCount(adminRole._id)) <= 1) {
            return fail(res, 409, 'last_admin', 'The last admin cannot be demoted');
        }
        user.roles = (user.roles || []).filter(id => String(id) !== String(adminRole._id));
        await user.save();
        //Two concurrent demotions can both pass the check above; the recount owns the final word.
        if ((await enabledAdminCount(adminRole._id)) === 0) {
            user.roles = [...user.roles, adminRole._id];
            await user.save();
            return fail(res, 409, 'last_admin', 'The last admin cannot be demoted');
        }
    } else {
        user.roles = [...(user.roles || []), adminRole._id];
        await user.save();
    }

    await audit(req, 'user.role', 'user', user._id, req.body.admin ? 'admin granted' : 'admin removed');
    return res.status(200).send(await userRowWithRoles(user));
}));

router.post('/users/:id/disabled', serializeAdminMutation, wrap(async function(req, res) {
    if (typeof req.body.disabled !== 'boolean') {
        return fail(res, 400, 'invalid', 'disabled must be true or false');
    }
    const user = await findUser(req.params.id);
    if (!user) {
        return fail(res, 404, 'not_found', 'User not found');
    }

    if (req.body.disabled && String(user._id) === String(req.current_user._id)) {
        return fail(res, 409, 'self', 'An admin cannot disable themselves');
    }
    const adminRole = await collections.Role.findOne({ name: 'admin' });
    const disablingAdmin = req.body.disabled && adminRole && isAdmin(user, adminRole._id) && !user.is_disabled;
    if (disablingAdmin && (await enabledAdminCount(adminRole._id)) <= 1) {
        return fail(res, 409, 'last_admin', 'The last admin cannot be disabled');
    }

    user.is_disabled = req.body.disabled;
    await user.save();

    //Two concurrent disables can both pass the check above; the recount owns the final word.
    if (disablingAdmin && (await enabledAdminCount(adminRole._id)) === 0) {
        user.is_disabled = false;
        await user.save();
        return fail(res, 409, 'last_admin', 'The last admin cannot be disabled');
    }

    await audit(req, 'user.disabled', 'user', user._id, req.body.disabled ? 'account disabled' : 'account enabled');
    return res.status(200).send(await userRowWithRoles(user));
}));

router.post('/users/:id/password', wrap(async function(req, res) {
    const user = await findUser(req.params.id);
    if (!user) {
        return fail(res, 404, 'not_found', 'User not found');
    }

    //Returned once here, stored hashed; the audit row never holds it.
    const password = crypto.randomBytes(9).toString('base64url');
    user.password = bcrypt.hashSync(password, 10);
    user.must_change_password = true;
    await user.save();

    await audit(req, 'user.password', 'user', user._id, 'temporary password issued, shown once');
    return res.status(200).send({ password, user: await userRowWithRoles(user) });
}));

//------------ Audit

//A row names its target by type and id; the reader needs the name, not the hex.
const AUDIT_TARGETS = {
    user: { collection: collections.User, field: 'username' },
    ingredient: { collection: collections.Ingredient, field: 'name' },
    dish: { collection: collections.Dish, field: 'name' },
    job: { collection: collections.AdminJob, field: 'type' }
};

//A post names its parent plus its author, so it needs the parent and user reads too.
const POST_TARGETS = {
    dish_post: { collection: 'DishPost', parent: 'dish_id', parentCollection: 'Dish' },
    ingredient_post: { collection: 'IngredientPost', parent: 'ingredient_id', parentCollection: 'Ingredient' }
};

const postTargetLabels = async function(type, valid, labels) {
    const spec = POST_TARGETS[type];
    const posts = await collections[spec.collection].find({ _id: { $in: valid } })
        .select(`name ${spec.parent} user_id`);
    const parentIds = [...new Set(posts.map(post => post[spec.parent]).filter(Boolean).map(String))]
        .filter(id => mongoose.Types.ObjectId.isValid(id));
    const userIds = [...new Set(posts.map(post => post.user_id).filter(Boolean).map(String))]
        .filter(id => mongoose.Types.ObjectId.isValid(id));
    const [parents, users] = await Promise.all([
        collections[spec.parentCollection].find({ _id: { $in: parentIds } }).select('name'),
        collections.User.find({ _id: { $in: userIds } }).select('username')
    ]);
    const parentNames = new Map(parents.map(doc => [String(doc._id), doc.name]));
    const usernames = new Map(users.map(doc => [String(doc._id), doc.username]));
    posts.forEach((post) => {
        const name = parentNames.get(String(post[spec.parent] || '')) || post.name || '';
        const author = usernames.get(String(post.user_id || ''));
        const label = [name, author ? `by ${author}` : ''].filter(Boolean).join(' ');
        if (label) {
            labels.set(`${type}:${String(post._id)}`, label);
        }
    });
};

//One read per target type for the whole page; a deleted target keeps its raw id.
const auditTargetLabels = async function(rows) {
    const idsByType = new Map();
    for (const row of rows) {
        const type = row.target_type || '';
        const id = row.target_id || '';
        if (!type || !id) {
            continue;
        }
        if (!idsByType.has(type)) {
            idsByType.set(type, new Set());
        }
        idsByType.get(type).add(String(id));
    }

    const labels = new Map();
    const work = [];
    idsByType.forEach((ids, type) => {
        if (type === 'backup') {
            //Backup ids are derived from the file name, so the listing is the only index.
            work.push(backups.listBackups().then((list) => {
                const files = new Map(list.map(row => [String(row.id), row.file]));
                ids.forEach((id) => {
                    if (files.has(id)) {
                        labels.set(`backup:${id}`, files.get(id));
                    }
                });
            }));
            return;
        }
        if (POST_TARGETS[type]) {
            const valid = [...ids].filter(id => mongoose.Types.ObjectId.isValid(id));
            if (valid.length > 0) {
                work.push(postTargetLabels(type, valid, labels));
            }
            return;
        }
        if (type === 'comment') {
            //Deleting the comment removes the row, so the stored excerpt is the only label left.
            rows.forEach((row) => {
                if (row.target_type === 'comment' && row.target_id && row.detail) {
                    labels.set(`comment:${String(row.target_id)}`, String(row.detail));
                }
            });
            return;
        }
        const target = AUDIT_TARGETS[type];
        if (!target) {
            return;
        }
        const valid = [...ids].filter(id => mongoose.Types.ObjectId.isValid(id));
        if (valid.length === 0) {
            return;
        }
        work.push(target.collection.find({ _id: { $in: valid } }).select(target.field).then((docs) => {
            docs.forEach((doc) => {
                const value = doc[target.field];
                if (value) {
                    labels.set(`${type}:${String(doc._id)}`, String(value));
                }
            });
        }));
    });
    await Promise.all(work);
    return labels;
};

router.get('/audit', wrap(async function(req, res) {
    const page = pageOf(req.query.page);
    const filter = {};
    if (req.query.action) {
        filter.action = String(req.query.action);
    }
    if (req.query.actor) {
        filter.actor_name = new RegExp(escapeRegex(String(req.query.actor)), 'i');
    }

    const [rows, total, actions] = await Promise.all([
        collections.AuditLog.find(filter).sort({ created_at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
        collections.AuditLog.countDocuments(filter),
        collections.AuditLog.distinct('action')
    ]);

    const plain = rows.map(row => row.toObject());
    const labels = await auditTargetLabels(plain);
    const withLabels = plain.map(row => ({
        ...row,
        target_label: labels.get(`${row.target_type || ''}:${String(row.target_id || '')}`) || ''
    }));

    return res.status(200).send({
        rows: withLabels,
        total,
        page,
        actions: actions.filter(Boolean).sort()
    });
}));

module.exports = router;
