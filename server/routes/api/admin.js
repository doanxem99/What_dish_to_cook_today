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
const { version } = require('../../package.json');

const { collections, mongoose } = database;

const PAGE_SIZE = 25;
//The page poll asks every 15 s; the service probe runs at most twice a minute.
const TRANSLATION_CACHE_MS = 30 * 1000;

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

const probeBackupDir = async function() {
    const dir = backups.backupDir();
    const probe = path.join(dir, `.probe-${crypto.randomBytes(6).toString('hex')}`);
    try {
        await fs.mkdir(dir, { recursive: true });
        //Actually create and remove a file: a read-only directory still passes an access check.
        await fs.writeFile(probe, '');
        await fs.unlink(probe);
        return { dir_writable: true, dir };
    } catch (error) {
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
        translation, backupDir, lastBackupRows, lastReset, maintenanceDoc
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
        collections.Setting.findOne({ key: 'maintenance' })
    ]);

    const lastBackup = lastBackupRows.length > 0 ? lastBackupRows[0] : null;

    return res.status(200).send({
        version,
        uptime_s: Math.round(process.uptime()),
        database: databaseProbe,
        counts: { users, ingredients, dishes, dish_posts, comments, votes },
        translation,
        //Environment only: nothing calls an AI provider yet.
        ai: { configured: Boolean(String(process.env.AI_ENABLED || '').match(/^(1|true|yes)$/i)) },
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

router.post('/users/:id/role', wrap(async function(req, res) {
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

router.post('/users/:id/disabled', wrap(async function(req, res) {
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

router.get('/audit', wrap(async function(req, res) {
    const page = pageOf(req.query.page);
    const filter = {};
    if (req.query.action) {
        filter.action = String(req.query.action);
    }
    if (req.query.actor) {
        filter.actor_name = new RegExp(escapeRegex(String(req.query.actor)), 'i');
    }

    const [rows, total] = await Promise.all([
        collections.AuditLog.find(filter).sort({ created_at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
        collections.AuditLog.countDocuments(filter)
    ]);

    return res.status(200).send({ rows, total, page });
}));

module.exports = router;
