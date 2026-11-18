const { collections } = require('../database/connection');

const MAINTENANCE_KEY = 'maintenance';

//Routes that keep working while maintenance is on
const EXEMPT_PATHS = [/^\/api\/health$/, /^\/api\/auth(\/|$)/, /^\/api\/admin(\/|$)/];

const isMaintenance = async function() {
    const doc = await collections.Setting.findOne({ key: MAINTENANCE_KEY });
    return Boolean(doc && doc.enabled);
};

const setMaintenance = async function(enabled, reason, actor) {
    const source = actor || {};
    const actorId = source.id || source._id || null;
    return collections.Setting.findOneAndUpdate(
        { key: MAINTENANCE_KEY },
        {
            $set: {
                enabled: Boolean(enabled),
                reason: reason || '',
                actor_id: actorId,
                actor_name: source.name || source.username || '',
                updated_at: new Date()
            }
        },
        { upsert: true, new: true }
    );
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

module.exports = { isMaintenance, setMaintenance, maintenanceMiddleware };
