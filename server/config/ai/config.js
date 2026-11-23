//AI configuration. Values come from the environment only; the admin switch is
//stored in Setting and checked at call time by isAiRuntimeEnabled.
const DEFAULT_BASE_URL = 'https://opencode.ai/inference/go/openai/v1';

//USD per 1M tokens. OpenCode Go bills by plan, so these figures are estimates.
const COST_TABLE = {
    'deepseek-v4.1-flash': { input: 0.15, output: 0.60 }
};
const FALLBACK_COST = { input: 0.20, output: 0.80 };

const toBool = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const readConfig = (env = process.env) => ({
    enabled: toBool(env.AI_ENABLED),
    provider: env.AI_PROVIDER || 'opencode-go',
    apiKey: env.OPENCODE_API_KEY || '',
    model: env.AI_MODEL || 'deepseek-v4.1-flash',
    baseUrl: env.AI_BASE_URL || DEFAULT_BASE_URL,
    embedProvider: env.EMBED_PROVIDER || 'ollama',
    embedModel: env.EMBED_MODEL || 'bge-m3',
    ollamaUrl: env.OLLAMA_URL || 'http://localhost:11434',
    dailyLimit: toNumber(env.AI_DAILY_MESSAGE_LIMIT, 20),
    maxToolRounds: toNumber(env.AI_MAX_TOOL_ROUNDS, 3),
    monthlyBudgetUsd: toNumber(env.AI_MONTHLY_BUDGET_USD, 10)
});

const estimateCost = (model, tokensIn, tokensOut) => {
    if (!model || String(model).startsWith('ollama')) return 0;
    const price = COST_TABLE[model] || FALLBACK_COST;
    const usd = (tokensIn || 0) * price.input / 1e6 + (tokensOut || 0) * price.output / 1e6;
    return Math.round(usd * 1e6) / 1e6;
};

//Env must allow AI and no Setting row may have switched it off. Loaded lazily so
//unit tests do not open a database connection.
const isAiRuntimeEnabled = async () => {
    if (!readConfig().enabled) return false;
    const { collections } = require('../database/connection');
    const setting = await collections.Setting.findOne({ key: 'ai_enabled' });
    return !setting || setting.enabled !== false;
};

module.exports = {
    readConfig,
    estimateCost,
    isAiRuntimeEnabled
};
