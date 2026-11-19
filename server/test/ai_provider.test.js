const { test } = require('node:test');
const assert = require('node:assert');
const { readConfig, estimateCost } = require('../config/ai/config');
const { chatCompletion, listModels } = require('../config/ai/provider');

test('readConfig applies spec defaults', () => {
    const cfg = readConfig({ AI_ENABLED: 'true', OPENCODE_API_KEY: 'sk-test' });
    assert.strictEqual(cfg.enabled, true);
    assert.strictEqual(cfg.provider, 'opencode-go');
    assert.strictEqual(cfg.model, 'deepseek-v4.1-flash');
    assert.strictEqual(cfg.baseUrl, 'https://opencode.ai/inference/go/openai/v1');
    assert.strictEqual(cfg.embedModel, 'bge-m3');
    assert.strictEqual(cfg.dailyLimit, 20);
    assert.strictEqual(cfg.maxToolRounds, 3);
    assert.strictEqual(cfg.monthlyBudgetUsd, 10);
});

test('chatCompletion sends x-opencode-session header and parses tool_calls', async () => {
    let seenHeaders = null;
    let seenBody = null;
    const fakeFetch = async (url, options) => {
        seenHeaders = options.headers;
        seenBody = JSON.parse(options.body);
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
                            id: 'call_1',
                            type: 'function',
                            function: { name: 'search_dishes', arguments: '{"query":"noodle"}' }
                        }]
                    }
                }],
                usage: { prompt_tokens: 120, completion_tokens: 30 }
            })
        };
    };

    const cfg = readConfig({ AI_ENABLED: 'true', OPENCODE_API_KEY: 'sk-test' });
    const result = await chatCompletion({
        config: cfg,
        sessionId: 'sess-1234',
        messages: [{ role: 'user', content: 'warm noodles' }],
        tools: [{ name: 'search_dishes', description: 'Search', parameters: { type: 'object', properties: {} } }],
        fetchImpl: fakeFetch
    });

    assert.strictEqual(seenHeaders['x-opencode-session'], 'sess-1234');
    assert.strictEqual(seenHeaders['authorization'], 'Bearer sk-test');
    assert.strictEqual(seenBody.tools[0].function.name, 'search_dishes');
    assert.strictEqual(result.toolCalls.length, 1);
    assert.strictEqual(result.toolCalls[0].name, 'search_dishes');
    assert.deepStrictEqual(result.toolCalls[0].arguments, { query: 'noodle' });
    assert.strictEqual(result.tokensIn, 120);
    assert.strictEqual(result.tokensOut, 30);
});

test('chatCompletion rejects missing sessionId on opencode-go and maps upstream 503/502', async () => {
    const cfg = readConfig({ AI_ENABLED: 'true', OPENCODE_API_KEY: 'sk-test' });
    await assert.rejects(
        () => chatCompletion({ config: cfg, sessionId: '', messages: [] }),
        /x-opencode-session/i
    );
    const downFetch = async () => ({ ok: false, status: 503, text: async () => 'unavailable' });
    await assert.rejects(
        () => chatCompletion({ config: cfg, sessionId: 's1', messages: [{ role: 'user', content: 'hi' }], fetchImpl: downFetch }),
        (err) => err.status === 503 && err.code === 'provider_down'
    );
});

test('estimateCost computes positive USD from tokens', () => {
    const cost = estimateCost('deepseek-v4.1-flash', 1000, 500);
    assert.ok(cost > 0 && cost < 0.01);
});

test('listModels reads the upstream model list without a key', async () => {
    let seenUrl = null;
    let seenOptions = null;
    const fakeFetch = async (url, options) => {
        seenUrl = url;
        seenOptions = options;
        return { ok: true, status: 200, json: async () => ({ data: [{ id: 'deepseek-v4.1-flash' }] }) };
    };
    const cfg = readConfig({ AI_ENABLED: 'true' });

    const result = await listModels(cfg, fakeFetch);

    assert.strictEqual(seenUrl, 'https://opencode.ai/inference/go/openai/v1/models');
    assert.ok(!seenOptions || !seenOptions.headers || !seenOptions.headers.authorization);
    assert.deepStrictEqual(result, { ok: true, models: ['deepseek-v4.1-flash'] });
});

test('chatCompletion streams SSE deltas and accumulates tool_calls', async () => {
    const chunks = [
        'data: {"model":"deepseek-v4.1-flash","choices":[{"delta":{"content":"Warm "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"noodles."}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"search_dishes","arguments":"{\\"query\\":"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"noodle\\"}"}}]}}],"usage":{"prompt_tokens":9,"completion_tokens":4}}\n\n',
        'data: [DONE]\n\n'
    ];
    const fakeFetch = async () => ({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: (async function* () {
            for (const chunk of chunks) yield Buffer.from(chunk);
        })()
    });
    const tokens = [];
    const cfg = readConfig({ AI_ENABLED: 'true', OPENCODE_API_KEY: 'sk-test' });

    const result = await chatCompletion({
        config: cfg,
        sessionId: 'sess-sse',
        messages: [{ role: 'user', content: 'noodles' }],
        onToken: (text) => tokens.push(text),
        fetchImpl: fakeFetch
    });

    assert.deepStrictEqual(tokens, ['Warm ', 'noodles.']);
    assert.strictEqual(result.content, 'Warm noodles.');
    assert.strictEqual(result.toolCalls[0].name, 'search_dishes');
    assert.deepStrictEqual(result.toolCalls[0].arguments, { query: 'noodle' });
    assert.strictEqual(result.tokensIn, 9);
    assert.strictEqual(result.tokensOut, 4);
});
