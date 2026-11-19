const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let collections;
let embeddings;
let indexJob;

const fakeEmbed = async (text) => {
    const lower = String(text).toLowerCase();
    return [
        lower.includes('noodle') || lower.includes('phở') || lower.includes('bún') ? 1 : 0,
        lower.includes('rank') || lower.includes('board') ? 1 : 0,
        lower.includes('add') || lower.includes('create') ? 1 : 0,
        0.1
    ];
};

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('ai_embeddings_test');
    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;
    embeddings = require('../config/ai/embeddings');
    indexJob = require('../config/ai/index_job');
});

after(async () => {
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) await mongod.stop();
});

beforeEach(async () => {
    await Promise.all([
        collections.AiEmbedding.deleteMany({}),
        collections.AdminJob.deleteMany({}),
        collections.Dish.deleteMany({}),
        collections.DishPost.deleteMany({}),
        collections.Ingredient.deleteMany({}),
        collections.Comment.deleteMany({})
    ]);
});

test('allowlist includes PRODUCT.md, README.md, and docs/help/*.md, and excludes internal docs', async () => {
    const files = await embeddings.listAllowedDocPaths();
    assert.ok(files.includes('PRODUCT.md'));
    assert.ok(files.includes('README.md'));
    assert.ok(files.includes('docs/help/adding-a-dish.md'));
    assert.ok(files.includes('docs/help/how-the-board-ranks.md'));
    assert.ok(!files.some(f => f.includes('KNOWN_ISSUES') || f.includes('ARCHITECTURE') || f.includes('API') || f.includes('superpowers') || f.includes('impl')));
});

test('readAllowedDoc refuses every internal doc path', async () => {
    assert.strictEqual(await embeddings.readAllowedDoc('docs/KNOWN_ISSUES.md'), null);
    assert.strictEqual(await embeddings.readAllowedDoc('docs/ARCHITECTURE.md'), null);
    assert.strictEqual(await embeddings.readAllowedDoc('docs/API.md'), null);
    assert.strictEqual(await embeddings.readAllowedDoc('docs/superpowers/plans/2026-11-19-ai-assistant.md'), null);
    assert.strictEqual(await embeddings.readAllowedDoc('docs/impl/2026-11-16-repo-hygiene.md'), null);
    assert.strictEqual(await embeddings.readAllowedDoc('AGENTS.md'), null);
    assert.strictEqual(await embeddings.readAllowedDoc('docs/help/../../docs/KNOWN_ISSUES.md'), null);
    const help = await embeddings.readAllowedDoc('docs/help/adding-a-dish.md');
    assert.ok(typeof help === 'string' && help.includes('dish'));
});

test('editing a dish re-embeds only changed hash and deleting it removes the vector', async () => {
    let calls = 0;
    const countingEmbed = async (text) => {
        calls += 1;
        return fakeEmbed(text);
    };
    const dish = await collections.Dish.create({ name: 'Beef Noodle', name_vi: 'Phở bò', best_post_id: '' });
    const post = await collections.DishPost.create({
        dish_id: String(dish._id),
        user_id: 'u1',
        unique_id: `${dish._id}_u1`,
        is_best_post: true,
        name: 'Beef Noodle',
        name_vi: 'Phở bò',
        short_detail: 'Warm noodle broth',
        short_detail_vi: 'Nước dùng phở ấm',
        display_blocks: [{ type: 'text', text: 'Simmer broth', text_vi: 'Ninh nước dùng' }]
    });
    dish.best_post_id = String(post._id);
    await dish.save();

    await embeddings.syncTarget({ targetType: 'dish', targetId: String(dish._id), embedFn: countingEmbed });
    const firstCalls = calls;
    assert.strictEqual(firstCalls, 2); // en + vi

    // Re-syncing unchanged content makes 0 embedding calls
    await embeddings.syncTarget({ targetType: 'dish', targetId: String(dish._id), embedFn: countingEmbed });
    assert.strictEqual(calls, firstCalls);

    // Editing English short_detail re-embeds only the changed locale
    post.short_detail = 'Rich beef noodle soup with ginger';
    await post.save();
    await embeddings.syncTarget({ targetType: 'dish', targetId: String(dish._id), embedFn: countingEmbed });
    assert.strictEqual(calls, firstCalls + 1);

    const retrieved = await embeddings.retrievePassages('noodle soup', { locale: 'en', embedFn: fakeEmbed });
    assert.strictEqual(retrieved.embedDown, false);
    assert.ok(retrieved.passages[0].text.includes('Rich beef noodle soup with ginger'));

    // Deleting the dish removes its embeddings
    await collections.Dish.deleteOne({ _id: dish._id });
    await collections.DishPost.deleteMany({ dish_id: String(dish._id) });
    await embeddings.syncTarget({ targetType: 'dish', targetId: String(dish._id), embedFn: countingEmbed });
    assert.strictEqual(await collections.AiEmbedding.countDocuments({ target_id: String(dish._id) }), 0);
});

test('rebuildIndex embeds catalog rows and only allowlisted docs', async () => {
    const ing = await collections.Ingredient.create({ name: 'Egg', name_vi: 'Trứng' });
    const dish = await collections.Dish.create({ name: 'Egg Rice', name_vi: 'Cơm trứng', best_post_id: '' });
    const post = await collections.DishPost.create({
        dish_id: String(dish._id),
        user_id: 'u1',
        unique_id: `${dish._id}_u1`,
        is_best_post: true,
        name: 'Egg Rice',
        name_vi: 'Cơm trứng',
        ingredients: [String(ing._id)],
        short_detail: 'Quick rice',
        short_detail_vi: 'Cơm nhanh'
    });
    dish.best_post_id = String(post._id);
    await dish.save();

    await embeddings.rebuildIndex({ embedFn: fakeEmbed });

    const docRows = await collections.AiEmbedding.find({ target_type: 'doc' });
    assert.ok(docRows.length > 0);
    const sources = docRows.map(row => row.target_id);
    assert.ok(sources.includes('docs/help/adding-a-dish.md'));
    assert.ok(!sources.some(source => /KNOWN_ISSUES|ARCHITECTURE|API\.md|superpowers|impl/.test(source)));
    assert.ok(await collections.AiEmbedding.countDocuments({ target_type: 'dish', target_id: String(dish._id) }) > 0);
    assert.ok(await collections.AiEmbedding.countDocuments({ target_type: 'ingredient', target_id: String(ing._id) }) > 0);
});

test('embedText posts the model and prompt to Ollama and returns the vector', async () => {
    let seenUrl = null;
    let seenBody = null;
    const fakeFetch = async (url, options) => {
        seenUrl = url;
        seenBody = JSON.parse(options.body);
        return {
            ok: true,
            status: 200,
            json: async () => ({ embedding: [0.5, 0.25] })
        };
    };
    const vector = await embeddings.embedText('warm noodles', {
        config: { ollamaUrl: 'http://ollama:11434', embedModel: 'bge-m3' },
        fetchImpl: fakeFetch
    });
    assert.strictEqual(seenUrl, 'http://ollama:11434/api/embeddings');
    assert.strictEqual(seenBody.model, 'bge-m3');
    assert.strictEqual(seenBody.prompt, 'warm noodles');
    assert.deepStrictEqual(vector, [0.5, 0.25]);
});

test('scheduleIndex coalesces duplicate queued jobs for the same row', async () => {
    const first = await indexJob.scheduleIndex('dish', '64b000000000000000000011');
    const second = await indexJob.scheduleIndex('dish', '64b000000000000000000011');
    assert.strictEqual(String(first._id), String(second._id));
    assert.strictEqual(await collections.AdminJob.countDocuments({ type: 'ai_index', status: 'queued' }), 1);
});

test('retrievePassages falls back gracefully when embedding service is down', async () => {
    const failingEmbed = async () => { throw new Error('connect ECONNREFUSED'); };
    const result = await embeddings.retrievePassages('noodles', { locale: 'en', embedFn: failingEmbed });
    assert.strictEqual(result.embedDown, true);
    assert.deepStrictEqual(result.passages, []);
});
