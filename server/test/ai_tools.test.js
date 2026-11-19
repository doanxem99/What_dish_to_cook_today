const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let collections;
let tools;

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('ai_tools_test');
    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;
    tools = require('../config/ai/tools');
});

after(async () => {
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) await mongod.stop();
});

beforeEach(async () => {
    await Promise.all([
        collections.Dish.deleteMany({}),
        collections.DishPost.deleteMany({}),
        collections.Ingredient.deleteMany({}),
        collections.UserEvent.deleteMany({})
    ]);
});

test('capability gating restricts tools and keeps start_draft confirm-only', async () => {
    assert.deepStrictEqual(
        tools.toolDefinitionsFor('read_only').map(t => t.name),
        ['search_dishes', 'get_dish', 'get_help']
    );
    const denied = await tools.executeTool('select_ingredients', { names: ['Egg'] }, { capability: 'read_only' });
    assert.strictEqual(denied.error, 'capability_denied');

    const ing = await collections.Ingredient.create({ name: 'Egg', name_vi: 'Trứng' });
    const prep = await tools.executeTool('select_ingredients', { names: ['Egg'] }, { capability: 'prepare' });
    assert.strictEqual(prep.clientAction.apply, false);
    assert.strictEqual(prep.items[0].id, String(ing._id));

    const free = await tools.executeTool('select_ingredients', { names: ['Trứng'] }, { capability: 'act_freely' });
    assert.strictEqual(free.clientAction.apply, true);

    const draft = await tools.executeTool('start_draft', { name: 'Egg Toast', ingredients: ['Egg'] }, { capability: 'act_freely' });
    assert.strictEqual(draft.clientAction.apply, false);
});

test('search_dishes and get_dish read display_blocks and return real catalog dishes only', async () => {
    const egg = await collections.Ingredient.create({ name: 'Egg', name_vi: 'Trứng' });
    const rice = await collections.Ingredient.create({ name: 'Rice', name_vi: 'Gạo' });
    const dish = await collections.Dish.create({ name: 'Egg Fried Rice', name_vi: 'Cơm chiên trứng', best_post_id: '' });
    const post = await collections.DishPost.create({
        dish_id: String(dish._id),
        user_id: 'u1',
        unique_id: `${dish._id}_u1`,
        is_best_post: true,
        name: 'Egg Fried Rice',
        name_vi: 'Cơm chiên trứng',
        short_detail: 'Quick skillet rice',
        short_detail_vi: 'Cơm chiên nhanh',
        ingredients: [String(egg._id), String(rice._id)],
        servings: 2,
        nutrition: { calories: 410, protein: 14, fat: 12, carbs: 60 },
        ingredient_amounts: [{ ingredient_id: String(egg._id), grams: 100 }],
        display_blocks: [{ type: 'text', text: 'Beat eggs and fry rice.', text_vi: 'Đánh trứng và chiên cơm.' }]
    });
    dish.best_post_id = String(post._id);
    await dish.save();

    const found = await tools.executeTool(
        'search_dishes',
        { ingredients: ['Egg'], query: 'rice', limit: 5 },
        { capability: 'read_only', locale: 'vi', embedFn: async () => [0, 0, 0, 0] }
    );
    assert.strictEqual(found.dishes.length, 1);
    assert.strictEqual(found.dishes[0].dish_id, String(dish._id));
    assert.strictEqual(found.dishes[0].name_vi, 'Cơm chiên trứng');

    const detail = await tools.executeTool('get_dish', { dish_id: String(dish._id) }, { capability: 'read_only', locale: 'en' });
    assert.strictEqual(detail.steps[0].text, 'Beat eggs and fry rice.');
    assert.strictEqual(detail.amounts[0].grams, 100);
    assert.strictEqual(detail.link, `/dish_detail?dish_id=${dish._id}`);
});

test('open_dish needs act_freely and validates the dish exists', async () => {
    const dish = await collections.Dish.create({ name: 'Egg Rice', name_vi: 'Cơm trứng' });
    const denied = await tools.executeTool('open_dish', { dish_id: String(dish._id) }, { capability: 'prepare' });
    assert.strictEqual(denied.error, 'capability_denied');

    const opened = await tools.executeTool('open_dish', { dish_id: String(dish._id) }, { capability: 'act_freely' });
    assert.strictEqual(opened.clientAction.apply, true);
    assert.strictEqual(opened.clientAction.link, `/dish_detail?dish_id=${dish._id}`);

    const missing = await tools.executeTool('open_dish', { dish_id: '64b000000000000000000099' }, { capability: 'act_freely' });
    assert.strictEqual(missing.error, 'not_found');
});

test('get_help searches only allowlisted docs and refuses internal doc topics', async () => {
    const res = await tools.executeTool('get_help', { topic: 'KNOWN_ISSUES security JWT_SECRET' }, { capability: 'read_only' });
    assert.ok(res.passages.every(p => ['PRODUCT.md', 'README.md', 'docs/help/adding-a-dish.md', 'docs/help/how-the-board-ranks.md', 'catalog'].includes(p.source)));
    assert.ok(!res.passages.some(p => p.text.includes('f3738d6')));
});
