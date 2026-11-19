//Authenticated AI routes. The router answers 404 ai_not_configured when AI_ENABLED
//is off, so a client can hide the assistant instead of showing an error.
const express = require('express');
const router = express.Router();
const aiConfig = require('../../config/ai/config');
const chat = require('../../config/ai/chat');
const events = require('../../config/ai/events');
const { collections } = require('../../config/database/connection');
const { verifyToken } = require('./verifyToken');

const MODES = ['cook', 'walkthrough', 'help'];
const CAPABILITIES = ['read_only', 'prepare', 'act_freely'];
const LOCALES = ['en', 'vi'];
const USER_EVENT_TYPES = ['dish_viewed', 'dish_cooked', 'ingredient_picked'];
const MAX_MESSAGE_LENGTH = 2000;

const fail = (res, status, code, message, extra) => res.status(status).send({
    error: { code, message, ...(extra || {}) }
});

const wrap = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => {
        if (!res.headersSent) {
            fail(res, error.status || 500, error.code || 'server_error', error.message);
        }
    });
};

//The whole surface disappears when the feature is not configured.
router.use((req, res, next) => {
    if (!aiConfig.readConfig().enabled) {
        return fail(res, 404, 'ai_not_configured', 'AI is not enabled');
    }
    return next();
});

router.get('/status', verifyToken, wrap(async (req, res) => {
    const config = aiConfig.readConfig();
    const user = req.current_user;
    const enabled = await aiConfig.isAiRuntimeEnabled();
    const quota = await chat.getQuotaStatus(user, config);
    return res.status(200).send({
        enabled,
        capability: user.ai_capability || 'read_only',
        quota
    });
}));

router.post('/chat', verifyToken, wrap(async (req, res) => {
    const config = aiConfig.readConfig();
    const user = req.current_user;
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const mode = body.mode;
    const capability = body.capability || user.ai_capability || 'read_only';
    const locale = body.locale || 'en';

    if (message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
        return fail(res, 400, 'invalid_message', `message must be 1-${MAX_MESSAGE_LENGTH} characters`);
    }
    if (!MODES.includes(mode)) {
        return fail(res, 400, 'invalid_mode', 'mode must be cook, walkthrough or help');
    }
    if (!CAPABILITIES.includes(capability)) {
        return fail(res, 400, 'invalid_capability', 'capability is not recognised');
    }
    if (!LOCALES.includes(locale)) {
        return fail(res, 400, 'invalid_locale', 'locale must be en or vi');
    }

    if (!(await aiConfig.isAiRuntimeEnabled()) || user.ai_disabled === true) {
        return fail(res, 403, 'ai_disabled', 'AI is disabled');
    }
    if (await chat.isMonthlyBudgetReached(config)) {
        return fail(res, 403, 'ai_disabled', 'The AI monthly budget is reached');
    }

    const quota = await chat.getQuotaStatus(user, config);
    if (quota.remaining <= 0) {
        return fail(res, 429, 'quota_reached', 'Daily AI message limit reached', { resets_at: quota.resets_at });
    }

    //Atomic admission: a parallel request that loses the race never reaches the provider.
    const reservation = await chat.reserveQuota(user, config);
    if (!reservation) {
        return fail(res, 429, 'quota_reached', 'Daily AI message limit reached', { resets_at: quota.resets_at });
    }
    try {
        await chat.runChatStream({ res, user, message, mode, capability, locale, config, req });
    } finally {
        await chat.releaseQuota(reservation);
    }
}));

router.get('/conversation', verifyToken, wrap(async (req, res) => {
    const config = aiConfig.readConfig();
    const user = req.current_user;
    const conversation = await collections.AiConversation.findOne({ user_id: user._id });
    const messages = conversation
        ? conversation.messages.map((entry) => ({
            role: entry.role,
            content: entry.content || '',
            mode: entry.mode || '',
            citations: entry.citations || [],
            tool_summary: entry.tool_summary || null,
            stopped: entry.stopped === true,
            created_at: entry.created_at || null
        }))
        : [];
    const quota = await chat.getQuotaStatus(user, config);
    return res.status(200).send({
        messages,
        capability: user.ai_capability || 'read_only',
        quota
    });
}));

router.delete('/conversation', verifyToken, wrap(async (req, res) => {
    await collections.AiConversation.deleteMany({ user_id: req.current_user._id });
    return res.status(200).send({ status: 'ok' });
}));

router.post('/capability', verifyToken, wrap(async (req, res) => {
    const capability = req.body && req.body.capability;
    if (!CAPABILITIES.includes(capability)) {
        return fail(res, 400, 'invalid_capability', 'capability is not recognised');
    }
    const user = req.current_user;
    user.ai_capability = capability;
    await user.save();
    return res.status(200).send({ status: 'ok', capability });
}));

router.post('/events', verifyToken, wrap(async (req, res) => {
    const body = req.body || {};
    if (!USER_EVENT_TYPES.includes(body.type)) {
        return fail(res, 400, 'invalid_event', 'type must be dish_viewed, dish_cooked or ingredient_picked');
    }
    const row = await events.recordUserEvent({
        userId: req.current_user._id,
        type: body.type,
        targetId: body.target_id,
        dishPostId: body.dish_post_id
    });
    if (!row) {
        return fail(res, 400, 'invalid_target', 'target_id does not resolve to a catalog row');
    }
    return res.status(200).send({ status: 'ok' });
}));

router.get('/events', verifyToken, wrap(async (req, res) => {
    const page = Number.parseInt(req.query.page, 10);
    const result = await events.listUserEvents(req.current_user._id, {
        page: Number.isInteger(page) && page > 0 ? page : 1
    });
    return res.status(200).send(result);
}));

router.delete('/events', verifyToken, wrap(async (req, res) => {
    const deleted = await events.clearUserEvents(req.current_user._id);
    return res.status(200).send({ status: 'ok', deleted });
}));

module.exports = router;
