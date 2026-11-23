const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let inferMode;
let PROTOTYPES;

//intent.js pulls embeddings.js, which opens the connection module at load time.
before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('ai_intent_test');
    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    ({ inferMode, PROTOTYPES } = require('../config/ai/intent'));
});

after(async () => {
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) await mongod.stop();
});

const embedDown = async () => { throw new Error('connect ECONNREFUSED'); };

const modeVectors = (vectors) => async (text) => {
    for (const [mode, vector] of Object.entries(vectors)) {
        if (mode === 'query') continue;
        if (PROTOTYPES.en[mode].includes(text)) return vector;
    }
    return vectors.query;
};

test('EN rules pick each mode with the right source', async () => {
    const cases = [
        ['What can I cook with the ingredients I have?', 'cook'],
        ['How do I cook this dish step by step?', 'walkthrough'],
        ['How do I add a new dish to the site?', 'help']
    ];
    for (const [message, mode] of cases) {
        const result = await inferMode({ message, locale: 'en', embedFn: embedDown });
        assert.deepStrictEqual(result, { mode, source: 'rules' }, message);
    }
});

test('VI rules pick each mode with the right source', async () => {
    const cases = [
        ['Hôm nay tôi có trứng, nấu gì?', 'cook'],
        ['Cách nấu món này như thế nào?', 'walkthrough'],
        ['Làm sao để bình chọn và bình luận?', 'help']
    ];
    for (const [message, mode] of cases) {
        const result = await inferMode({ message, locale: 'vi', embedFn: embedDown });
        assert.deepStrictEqual(result, { mode, source: 'rules' }, message);
    }
});

test('a tie between two modes falls to the context default', async () => {
    const message = 'Giúp tôi nấu gì và cách nấu món này';
    const empty = await inferMode({ message, locale: 'vi', embedFn: embedDown });
    assert.deepStrictEqual(empty, { mode: 'help', source: 'default' });

    const stocked = await inferMode({ message, locale: 'vi', context: { pantry_count: 3 }, embedFn: embedDown });
    assert.deepStrictEqual(stocked, { mode: 'cook', source: 'default' });
});

test('no rule hit uses the embedding tier when the mean clears the threshold', async () => {
    const message = 'xyzzy plugh';
    const embedFn = modeVectors({ cook: [1, 0, 0], walkthrough: [0, 1, 0], help: [0, 0, 1], query: [0.9, 0.1, 0] });
    const result = await inferMode({ message, locale: 'en', embedFn });
    assert.deepStrictEqual(result, { mode: 'cook', source: 'embedding' });
});

test('a weak embedding match falls to the context default', async () => {
    const message = 'xyzzy plugh';
    const embedFn = async (text) => (text === message ? [1, 0, 0] : [0, 1, 0]);
    const result = await inferMode({ message, locale: 'en', context: { pantry_count: 2 }, embedFn });
    assert.deepStrictEqual(result, { mode: 'cook', source: 'default' });
});

test('an embedding failure falls through to the default', async () => {
    const result = await inferMode({ message: 'xyzzy plugh', locale: 'en', embedFn: embedDown });
    assert.deepStrictEqual(result, { mode: 'help', source: 'default' });

    const stocked = await inferMode({
        message: 'xyzzy plugh',
        locale: 'en',
        context: { pantry_count: 1 },
        embedFn: embedDown
    });
    assert.deepStrictEqual(stocked, { mode: 'cook', source: 'default' });
});

test('a rule winner never reaches the embedder', async () => {
    let calls = 0;
    const embedFn = async () => {
        calls += 1;
        return [1, 0, 0];
    };
    const result = await inferMode({ message: 'I have eggs and rice, what can I cook?', locale: 'en', embedFn });
    assert.strictEqual(result.source, 'rules');
    assert.strictEqual(calls, 0);
});
