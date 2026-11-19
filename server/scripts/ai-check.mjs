// Provider check for the AI assistant.
//
// Usage (from server/):
//   node scripts/ai-check.mjs
//
// Reads server/.env when present; OPENCODE_API_KEY enables the live tool-call
// probe. Always lists models first, then either prints "skipped: no key"
// (exit 0), "pass" (exit 0) or "fail: <reason>" (exit 1).
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { readConfig } = require('../config/ai/config.js');
const { chatCompletion, listModels } = require('../config/ai/provider.js');

const SEARCH_TOOL = {
    name: 'search_dishes',
    description: 'Find dishes in the catalog that use the given ingredients or match a query.',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Free-text dish or flavour query' },
            ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredient names' }
        }
    }
};

export const runAiCheck = async ({ env = process.env, fetchImpl = fetch, log = console.log } = {}) => {
    const config = readConfig(env);

    const probe = await listModels(config, fetchImpl);
    const models = probe.models || [];
    if (!probe.ok) log('models: unavailable');
    else if (models.length) log(`models: ${models.join(', ')}`);

    if (!env.OPENCODE_API_KEY || !String(env.OPENCODE_API_KEY).trim()) {
        log('skipped: no key');
        return { status: 'skipped', reason: 'no key', models };
    }

    try {
        const result = await chatCompletion({
            config,
            sessionId: randomUUID(),
            messages: [{ role: 'user', content: 'Find a warm noodle dish for dinner.' }],
            tools: [SEARCH_TOOL],
            fetchImpl
        });
        const answered = result.toolCalls.length > 0 || Boolean(result.content && result.content.trim());
        if (!answered) {
            log('fail: empty reply and no tool call');
            return { status: 'fail', reason: 'empty reply and no tool call', models, toolCalls: result.toolCalls };
        }
        log('pass');
        return { status: 'pass', models, toolCalls: result.toolCalls };
    } catch (err) {
        const reason = err.code ? `${err.code}: ${err.message}` : (err.message || String(err));
        log(`fail: ${reason}`);
        return { status: 'fail', reason, models, toolCalls: [] };
    }
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
    const envFile = new URL('../.env', import.meta.url);
    if (existsSync(envFile)) process.loadEnvFile(fileURLToPath(envFile));
    const result = await runAiCheck();
    process.exitCode = result.status === 'fail' ? 1 : 0;
}
