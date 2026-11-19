const { test } = require('node:test');
const assert = require('node:assert');

test('ai-check prints skipped: no key when OPENCODE_API_KEY is absent', async () => {
    const { runAiCheck } = await import('../scripts/ai-check.mjs');
    const lines = [];
    const fakeFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'deepseek-v4.1-flash' }] })
    });
    const res = await runAiCheck({ env: { AI_ENABLED: 'true', OPENCODE_API_KEY: '' }, fetchImpl: fakeFetch, log: (m) => lines.push(m) });
    assert.strictEqual(res.status, 'skipped');
    assert.ok(lines.some(line => line.includes('skipped: no key')));
});

test('ai-check sends one tool-calling request and prints pass when key is present', async () => {
    const { runAiCheck } = await import('../scripts/ai-check.mjs');
    const lines = [];
    const fakeFetch = async (url) => {
        if (url.endsWith('/models')) {
            return { ok: true, status: 200, json: async () => ({ data: [{ id: 'deepseek-v4.1-flash' }] }) };
        }
        return {
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({
                model: 'deepseek-v4.1-flash',
                choices: [{
                    message: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{
                            id: 'c1',
                            type: 'function',
                            function: { name: 'search_dishes', arguments: '{"query":"egg"}' }
                        }]
                    }
                }],
                usage: { prompt_tokens: 40, completion_tokens: 12 }
            })
        };
    };
    const res = await runAiCheck({
        env: { AI_ENABLED: 'true', OPENCODE_API_KEY: 'sk-live' },
        fetchImpl: fakeFetch,
        log: (m) => lines.push(m)
    });
    assert.strictEqual(res.status, 'pass');
    assert.ok(lines.some(line => line.includes('pass')));
});
