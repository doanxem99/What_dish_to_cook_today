const { collections } = require('../database/connection');

const MAINTENANCE_KEY = 'maintenance';

//Routes that keep working while maintenance is on. A trailing slash is allowed.
const EXEMPT_PATHS = [/^\/api\/health\/?$/, /^\/api\/auth(\/|$)/, /^\/api\/admin(\/|$)/];

//The middleware runs on every public request; one settings read per second is enough.
const CACHE_MS = 1000;
let cache = { value: false, at: 0 };

//The runner runs one job at a time, so one module value names the job that owns the flag.
let runningJobId = null;

const isMaintenanceDisabled = function() {
    const flag = String(process.env.MAINTENANCE_DISABLED || '').trim().toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
};

//Returns a promise: every call site awaits it or chains a catch.
const isMaintenance = async function() {
    //Escape hatch for a stuck flag on a running deployment.
    if (isMaintenanceDisabled()) {
        return false;
    }
    if (Date.now() - cache.at < CACHE_MS) {
        return cache.value;
    }
    const doc = await collections.Setting.findOne({ key: MAINTENANCE_KEY });
    const enabled = Boolean(doc && doc.enabled);
    cache = { value: enabled, at: Date.now() };
    return enabled;
};

//The runner marks its job before the handler starts, so a handler that sets the flag records its owner.
const setRunningJob = function(jobId) {
    runningJobId = jobId ? String(jobId) : null;
};

//ownerJobId defaults to the job this process is running; pass null to set an unowned flag.
const setMaintenance = async function(enabled, reason, actor, ownerJobId) {
    const source = actor || {};
    const actorId = source.id || source._id || null;
    const owner = enabled ? (ownerJobId !== undefined ? ownerJobId : runningJobId) : null;
    const updated = await collections.Setting.findOneAndUpdate(
        { key: MAINTENANCE_KEY },
        {
            $set: {
                enabled: Boolean(enabled),
                reason: reason || '',
                actor_id: actorId,
                actor_name: source.name || source.username || '',
                owner_job_id: owner,
                updated_at: new Date()
            }
        },
        { upsert: true, new: true }
    );
    cache = { value: Boolean(enabled), at: Date.now() };
    return updated;
};

//Only the job that set the flag may clear it; an unowned flag can be cleared by anyone.
const releaseMaintenance = async function(jobId, reason) {
    const doc = await collections.Setting.findOne({ key: MAINTENANCE_KEY });
    const owner = doc && doc.owner_job_id ? String(doc.owner_job_id) : null;
    if (owner && String(jobId) !== owner) {
        return false;
    }
    await setMaintenance(false, reason, null);
    return true;
};

//Public API answers 503 while a destructive job runs; the admin area stays reachable.
const maintenanceMiddleware = function(req, res, next) {
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    if (EXEMPT_PATHS.some(pattern => pattern.test(req.path))) {
        return next();
    }
    isMaintenance()
        .then((enabled) => {
            if (!enabled) {
                return next();
            }
            return res.status(503).send({
                status: 'maintenance',
                message: 'The site is in maintenance mode. Please try again later.'
            });
        })
        //A settings read failure must not take the site down
        .catch(() => next());
};

module.exports = { isMaintenance, setMaintenance, releaseMaintenance, setRunningJob, maintenanceMiddleware };
