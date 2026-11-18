const { collections } = require('../database/connection');

//Audit rows are insert-only: no update or delete path exists anywhere in code.
const recordAudit = async function(options) {
    const source = options || {};
    return collections.AuditLog.create({
        actor_id: source.actorId || null,
        actor_name: source.actorName || '',
        action: source.action || '',
        target_type: source.targetType || '',
        target_id: source.targetId ? String(source.targetId) : '',
        result: source.result || 'ok',
        detail: source.detail || '',
        ip: source.ip || '',
        created_at: new Date()
    });
};

module.exports = { recordAudit };
