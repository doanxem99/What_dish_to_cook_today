const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let collections;
let backups;
let catalogReset;
let maintenance;
let backupDir;

const CREATED = new Date('2026-03-04T05:06:07.890Z');

const writeArchive = function(name, archive) {
    fs.writeFileSync(path.join(backupDir, name), zlib.gzipSync(Buffer.from(JSON.stringify(archive), 'utf8')));
};

const readArchiveFile = function(file) {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(backupDir, file))).toString('utf8'));
};

//A restore-ready archive with one comment, so tests can name the data they expect back.
const archiveWith = function(commentBody) {
    return {
        format: 'wdtct-backup',
        version: 1,
        created_at: CREATED.toISOString(),
        collections: {
            ingredient: [],
            ingredient_post: [],
            dish: [],
            dish_post: [],
            vote: [],
            comment: commentBody ? [{
                _id: '64b0000000000000000000aa',
                dish_post_id: '64b000000000000000000009',
                user_id: '64b0000000000000000000bb',
                body: commentBody,
                date_time: CREATED.toISOString()
            }] : []
        }
    };
};

const clearDatabase = async function() {
    for (const model of Object.values(collections)) {
        await model.deleteMany({});
    }
};

const seedAccount = async function() {
    const role = await collections.Role.create({ name: 'user', description: 'User role' });
    const user = await collections.User.create({
        username: 'boss',
        email: 'boss@example.com',
        password: 'hash',
        roles: [role._id],
        created_at: CREATED
    });
    return { role, user };
};

const round = function(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

//Same recipe maths as scripts/dev-demo.mjs; a reset must keep the public site identical.
const expectedNutrition = function(amounts, servings, nutritionData) {
    const total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0 };
    for (const [name, grams] of Object.entries(amounts)) {
        const per100 = nutritionData[name] && nutritionData[name].per_100g;
        if (!per100) {
            continue;
        }
        for (const key of Object.keys(total)) {
            total[key] += (per100[key] || 0) * grams / 100;
        }
    }
    const portions = servings || 1;
    return {
        calories: Math.round(total.calories / portions),
        protein: round(total.protein / portions, 1),
        fat: round(total.fat / portions, 1),
        carbs: round(total.carbs / portions, 1),
        fiber: round(total.fiber / portions, 1),
        sodium: round(total.sodium / portions, 1)
    };
};

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('backups_test');
    backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdtct-backup-'));
    process.env.BACKUP_DIR = backupDir;

    const connection = require('../config/database/connection');
    await connection.mongoose.connection.asPromise();
    collections = connection.collections;

    backups = require('../config/admin/backups');
    catalogReset = require('../config/admin/reset');
    maintenance = require('../config/admin/maintenance');
});

after(async () => {
    const connection = require('../config/database/connection');
    await connection.mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
    fs.rmSync(backupDir, { recursive: true, force: true });
});

beforeEach(async () => {
    process.env.BACKUP_DIR = backupDir;
    fs.rmSync(backupDir, { recursive: true, force: true });
    fs.mkdirSync(backupDir, { recursive: true });
    await clearDatabase();
});

test('an archive round trip keeps ids, dates, Vietnamese text and numbers', async () => {
    const { user } = await seedAccount();
    const ingredient = await collections.Ingredient.create({
        name: 'Fish sauce',
        name_vi: 'Nước mắm',
        best_post_id: '',
        nutrition: { calories: 215, protein: 18.6 },
        is_need_update: false
    });
    await collections.Comment.create({
        dish_post_id: '64b000000000000000000009',
        user_id: user._id.toString(),
        body: 'Nước dùng là cả món ăn.',
        date_time: CREATED
    });

    const created = await backups.createBackup({ trigger: 'test', actor: { id: user._id, name: 'boss' } });

    assert.match(created.file, /^backup-\d{8}-\d{6}\.json\.gz$/);
    assert.strictEqual(created.bytes, fs.statSync(path.join(backupDir, created.file)).size);

    const archive = readArchiveFile(created.file);
    assert.strictEqual(archive.format, 'wdtct-backup');
    assert.strictEqual(archive.version, 1);
    assert.strictEqual(archive.created_at, created.created_at);
    assert.ok(!Number.isNaN(Date.parse(archive.created_at)));

    const exportedIngredient = archive.collections.ingredient[0];
    assert.strictEqual(exportedIngredient._id, ingredient._id.toString());
    assert.strictEqual(typeof exportedIngredient._id, 'string');
    assert.strictEqual(exportedIngredient.name_vi, 'Nước mắm');
    assert.strictEqual(exportedIngredient.nutrition.calories, 215);
    assert.strictEqual(exportedIngredient.nutrition.protein, 18.6);

    const exportedComment = archive.collections.comment[0];
    assert.strictEqual(exportedComment.date_time, CREATED.toISOString());

    const exportedUser = archive.collections.user[0];
    assert.strictEqual(exportedUser._id, user._id.toString());
    assert.strictEqual(exportedUser.created_at, CREATED.toISOString());
});

test('restore brings a round-tripped archive back as BSON', async () => {
    const { user } = await seedAccount();
    const comment = await collections.Comment.create({
        dish_post_id: '64b000000000000000000009',
        user_id: user._id.toString(),
        body: 'The broth is the whole dish.',
        date_time: CREATED
    });
    const created = await backups.createBackup({ trigger: 'test', actor: null });
    await collections.Comment.deleteMany({});

    await catalogReset.restoreBackup(created.id, { id: user._id, name: 'boss' });

    const restored = await collections.Comment.findById(comment._id);
    assert.ok(restored);
    assert.strictEqual(restored.date_time.toISOString(), CREATED.toISOString());
    assert.strictEqual(restored.body, 'The broth is the whole dish.');
});

test('restore refuses an archive missing dish and writes nothing', async () => {
    const { user } = await seedAccount();
    await collections.Ingredient.create({ name: 'Keep me', name_vi: 'Giữ tôi' });
    writeArchive('backup-20260101-000001.json.gz', {
        format: 'wdtct-backup',
        version: 1,
        created_at: CREATED.toISOString(),
        collections: {
            ingredient: [],
            ingredient_post: [],
            dish_post: [],
            vote: [],
            comment: []
        }
    });

    await assert.rejects(
        () => catalogReset.restoreBackup('backup-20260101-000001', { id: user._id, name: 'boss' }),
        /missing collection dish/
    );

    assert.strictEqual(await collections.Ingredient.countDocuments({}), 1);
    assert.strictEqual(await maintenance.isMaintenance(), false);
});

test('restore ignores user, audit_log and admin_job even when present', async () => {
    const { user } = await seedAccount();
    const audit = await collections.AuditLog.create({ action: 'backup.create', created_at: CREATED });
    const job = await collections.AdminJob.create({ type: 'backup', status: 'done', created_at: CREATED });
    writeArchive('backup-20260101-000002.json.gz', {
        format: 'wdtct-backup',
        version: 1,
        created_at: CREATED.toISOString(),
        collections: {
            ingredient: [{ _id: '64b0000000000000000000aa', name: 'Only row', name_vi: 'Một dòng' }],
            ingredient_post: [],
            dish: [],
            dish_post: [],
            vote: [],
            comment: [],
            user: [{ _id: '64b0000000000000000000bb', username: 'intruder', email: 'x@example.com', password: 'x' }],
            audit_log: [{ _id: '64b0000000000000000000cc', action: 'forged' }],
            admin_job: [{ _id: '64b0000000000000000000dd', type: 'reset', status: 'queued' }]
        }
    });

    await catalogReset.restoreBackup('backup-20260101-000002', { id: user._id, name: 'boss' });

    assert.strictEqual((await collections.Ingredient.find({})).length, 1);
    assert.strictEqual((await collections.User.countDocuments({})), 1);
    assert.strictEqual((await collections.User.findById(user._id)).username, 'boss');
    assert.strictEqual((await collections.AuditLog.countDocuments({})), 1);
    assert.strictEqual((await collections.AuditLog.findById(audit._id)).action, 'backup.create');
    assert.strictEqual((await collections.AdminJob.countDocuments({})), 1);
    assert.strictEqual((await collections.AdminJob.findById(job._id)).status, 'done');
});

test('reset leaves accounts and admin rows untouched and repopulates 38/13', async () => {
    const { role, user } = await seedAccount();
    await collections.AuditLog.create({ action: 'catalog.reset', created_at: CREATED });
    await collections.AdminJob.create({ type: 'reset', status: 'queued', created_at: CREATED });
    await collections.Setting.create({ key: 'maintenance', enabled: false, updated_at: CREATED });
    await collections.Ingredient.create({ name: 'Stale row', name_vi: 'Dòng cũ' });
    await collections.Comment.create({ body: 'stale', date_time: CREATED });

    const detail = await catalogReset.resetCatalog({ id: user._id, name: 'boss' });

    assert.match(detail, /backup-\d{8}-\d{6}/);
    assert.strictEqual(await collections.Ingredient.countDocuments({}), 38);
    assert.strictEqual(await collections.IngredientPost.countDocuments({}), 38);
    assert.strictEqual(await collections.Dish.countDocuments({}), 13);
    assert.strictEqual(await collections.DishPost.countDocuments({}), 13);
    assert.strictEqual(await collections.Vote.countDocuments({}), 0);
    assert.strictEqual(await collections.Comment.countDocuments({}), 0);
    assert.strictEqual((await collections.Ingredient.find({ name: 'Stale row' })).length, 0);

    assert.strictEqual(await collections.User.countDocuments({}), 1);
    assert.strictEqual((await collections.User.findById(user._id)).username, 'boss');
    assert.strictEqual((await collections.Role.findById(role._id)).name, 'user');
    assert.strictEqual(await collections.AuditLog.countDocuments({}), 1);
    assert.strictEqual(await collections.AdminJob.countDocuments({}), 1);
    assert.strictEqual(await collections.Setting.countDocuments({}), 1);

    assert.strictEqual(await maintenance.isMaintenance(), false);

    const voteIndexes = await collections.Vote.collection.indexes();
    assert.ok(voteIndexes.some(index => index.unique && index.key.user_id === 1 && index.key.dish_post_id === 1));
    const userIndexes = await collections.User.collection.indexes();
    assert.ok(userIndexes.some(index => index.unique && index.key.username === 1));
    assert.ok(userIndexes.some(index => index.unique && index.key.email === 1));
    const roleIndexes = await collections.Role.collection.indexes();
    assert.ok(roleIndexes.some(index => index.unique && index.key.name === 1));
    const ingredientIndexes = await collections.Ingredient.collection.indexes();
    assert.ok(ingredientIndexes.some(index => index.unique && index.key.name === 1));
    const dishIndexes = await collections.Dish.collection.indexes();
    assert.ok(dishIndexes.some(index => index.unique && index.key.name === 1));
    const ingredientPostIndexes = await collections.IngredientPost.collection.indexes();
    assert.ok(ingredientPostIndexes.some(index => index.unique && index.key.unique_id === 1));
    const dishPostIndexes = await collections.DishPost.collection.indexes();
    assert.ok(dishPostIndexes.some(index => index.unique && index.key.unique_id === 1));
});

test('reset writes the same catalog rows the demo seed does', async () => {
    const { user } = await seedAccount();
    const catalog = require('../config/catalog').loadCatalog();

    await catalogReset.resetCatalog({ id: user._id, name: 'boss' });

    for (const row of catalog.ingredients) {
        const ingredient = await collections.Ingredient.findOne({ name: row.name });
        assert.ok(ingredient, row.name);
        assert.strictEqual(ingredient.name_vi, row.name_vi);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(ingredient.nutrition)), row.nutrition);
        assert.strictEqual(ingredient.is_need_update, false);

        const post = await collections.IngredientPost.findById(ingredient.best_post_id);
        assert.ok(post, `${row.name} best post`);
        assert.strictEqual(post.is_best_post, true);
        assert.strictEqual(post.user_id, user._id.toString());
        assert.strictEqual(post.ingredient_id, ingredient._id.toString());
        assert.strictEqual(post.unique_id, `${ingredient._id}_${user._id}`);
        assert.strictEqual(post.type, row.type);
        assert.strictEqual(post.short_detail, row.short_detail);
        assert.strictEqual(post.short_detail_vi, row.short_detail_vi);
        assert.strictEqual(post.profile_image, row.image || '');
        assert.deepStrictEqual(JSON.parse(JSON.stringify(post.display_blocks)), [{
            type: 'text',
            text: `${row.name} is kept in the shared catalog so every cook means the same thing.`,
            text_vi: `${row.name_vi} được lưu trong danh mục chung để mọi người hiểu cùng một nghĩa.`,
            font_size: 14,
            color: 'black'
        }]);
    }

    const ingredientIds = {};
    for (const ingredient of await collections.Ingredient.find({})) {
        ingredientIds[ingredient.name] = ingredient._id.toString();
    }

    for (const dish of catalog.dishes) {
        const dishDoc = await collections.Dish.findOne({ name: dish.name });
        assert.ok(dishDoc, dish.name);
        assert.strictEqual(dishDoc.name_vi, dish.name_vi);
        assert.strictEqual(dishDoc.is_need_update, false);

        const post = await collections.DishPost.findById(dishDoc.best_post_id);
        assert.ok(post, `${dish.name} best post`);
        assert.strictEqual(post.name_vi, dish.name_vi);
        assert.strictEqual(post.user_id, user._id.toString());
        assert.strictEqual(post.dish_id, dishDoc._id.toString());
        assert.strictEqual(post.unique_id, `${dishDoc._id}_${user._id}`);
        assert.strictEqual(post.is_best_post, true);
        assert.strictEqual(post.profile_image, dish.image || '');
        assert.strictEqual(post.servings, dish.servings || null);
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(post.nutrition)),
            expectedNutrition(dish.amounts, dish.servings, catalog.nutrition)
        );
        assert.deepStrictEqual(
            post.ingredient_amounts.map(row => ({ ingredient_id: row.ingredient_id, grams: row.grams })),
            Object.entries(dish.amounts).map(([name, grams]) => ({ ingredient_id: ingredientIds[name], grams }))
        );
        assert.deepStrictEqual(
            post.ingredients,
            dish.ingredients.map(name => ingredientIds[name]).filter(Boolean)
        );
        assert.deepStrictEqual(
            post.display_blocks.map(block => ({ type: block.type, text: block.text, text_vi: block.text_vi, font_size: block.font_size, color: block.color })),
            dish.steps.map(step => ({ type: 'text', text: step.text, text_vi: step.text_vi, font_size: 14, color: 'black' }))
        );
    }
});

test('reset aborts before touching the catalog when the backup fails', async () => {
    const { user } = await seedAccount();
    await collections.Ingredient.create({ name: 'Still here', name_vi: 'Vẫn ở đây' });
    const blocked = path.join(backupDir, 'not-a-directory');
    fs.writeFileSync(blocked, 'x');
    process.env.BACKUP_DIR = blocked;

    await assert.rejects(() => catalogReset.resetCatalog({ id: user._id, name: 'boss' }));

    assert.strictEqual(await collections.Ingredient.countDocuments({}), 1);
    assert.strictEqual(await maintenance.isMaintenance(), false);
});

test('prune keeps the newest ten archives', async () => {
    const archive = { format: 'wdtct-backup', version: 1, created_at: CREATED.toISOString(), collections: {} };
    for (let day = 1; day <= 12; day += 1) {
        writeArchive(`backup-202601${String(day).padStart(2, '0')}-000001.json.gz`, archive);
    }

    const removed = await backups.pruneBackups(10);
    const left = await backups.listBackups();

    assert.strictEqual(removed, 2);
    assert.strictEqual(left.length, 10);
    assert.strictEqual(left[0].file, 'backup-20260112-000001.json.gz');
    assert.strictEqual(left[9].file, 'backup-20260103-000001.json.gz');
    assert.ok(!fs.existsSync(path.join(backupDir, 'backup-20260101-000001.json.gz')));
});

test('a list entry never resolves a path outside the backup directory', async () => {
    writeArchive('backup-20260101-000003.json.gz', { format: 'wdtct-backup', version: 1, collections: {} });

    await assert.rejects(() => backups.readBackup('../backup-20260101-000003'), /not found/i);
});

test('the backup job row names the archive it wrote', async () => {
    const { user } = await seedAccount();
    const jobs = require('../config/admin/jobs');

    const backupJob = await jobs.enqueueJob('backup', { id: user._id, name: 'boss' }, {});
    const backupDone = await jobs.runNextJob();
    assert.strictEqual(backupDone.status, 'done');
    assert.match(backupDone.detail, /backup-\d{8}-\d{6}\.json\.gz/);

    const resetJob = await jobs.enqueueJob('reset', { id: user._id, name: 'boss' }, {});
    const resetDone = await jobs.runNextJob();
    assert.strictEqual(resetDone.status, 'done');
    assert.match(resetDone.detail, /backup-\d{8}-\d{6}/);
    assert.ok(fs.existsSync(path.join(backupDir, (await backups.listBackups())[0].file)));
    assert.strictEqual(await maintenance.isMaintenance(), false);
    assert.ok(resetJob && resetDone);
});

test('restoring the oldest of ten archives survives the prune it triggers', async () => {
    const { user } = await seedAccount();
    for (let day = 1; day <= 10; day += 1) {
        writeArchive(`backup-202601${String(day).padStart(2, '0')}-000001.json.gz`, archiveWith(`day ${day}`));
    }

    await catalogReset.restoreBackup('backup-20260101-000001', { id: user._id, name: 'boss' });

    const restored = await collections.Comment.find({});
    assert.strictEqual(restored.length, 1);
    assert.strictEqual(restored[0].body, 'day 1');
    assert.ok(fs.existsSync(path.join(backupDir, 'backup-20260101-000001.json.gz')));
});

test('reset switches maintenance on before it writes the backup', async () => {
    const { user } = await seedAccount();
    const realCreate = backups.createBackup;
    let flagDuringBackup = null;
    backups.createBackup = async (options) => {
        flagDuringBackup = await maintenance.isMaintenance();
        return realCreate(options);
    };
    try {
        await catalogReset.resetCatalog({ id: user._id, name: 'boss' });
    } finally {
        backups.createBackup = realCreate;
    }

    assert.strictEqual(flagDuringBackup, true);
    assert.strictEqual(await maintenance.isMaintenance(), false);
});

test('only known date fields become dates', () => {
    const doc = backups.fromExportDoc({
        body: '2026-03-04T05:06:07.890Z',
        updated_at: '2026-03-04T05:06:07.890Z'
    });

    assert.strictEqual(typeof doc.body, 'string');
    assert.strictEqual(doc.body, '2026-03-04T05:06:07.890Z');
    assert.ok(doc.updated_at instanceof Date);
    assert.strictEqual(doc.updated_at.toISOString(), '2026-03-04T05:06:07.890Z');
});

test('restore aborts on a malformed row before writing any collection', async () => {
    const { user } = await seedAccount();
    await collections.Ingredient.create({ name: 'Keep me', name_vi: 'Giữ tôi' });
    writeArchive('backup-20260101-000004.json.gz', {
        format: 'wdtct-backup',
        version: 1,
        created_at: CREATED.toISOString(),
        collections: {
            ingredient: [],
            ingredient_post: [],
            dish: ['not a document'],
            dish_post: [],
            vote: [],
            comment: []
        }
    });

    await assert.rejects(
        () => catalogReset.restoreBackup('backup-20260101-000004', { id: user._id, name: 'boss' }),
        /dish row 0 is not an object/
    );

    assert.strictEqual(await collections.Ingredient.countDocuments({}), 1);
    assert.strictEqual(await maintenance.isMaintenance(), false);
});

test('a partial archive never appears in the listing', async () => {
    const { user } = await seedAccount();
    const created = await backups.createBackup({ trigger: 'test', actor: { id: user._id } });
    assert.ok(!fs.existsSync(path.join(backupDir, `${created.file}.part`)));

    fs.writeFileSync(path.join(backupDir, `${created.file}.part`), 'half');
    fs.writeFileSync(path.join(backupDir, 'backup-20260101-000009.json.gz.part'), 'half');
    const listed = await backups.listBackups();

    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].file, created.file);
});

test('restore drops staging collections left behind by a crash', async () => {
    const { user } = await seedAccount();
    const db = require('../config/database/connection').mongoose.connection.db;
    await db.createCollection('comment_restore_1');
    writeArchive('backup-20260101-000005.json.gz', archiveWith('fresh'));

    await catalogReset.restoreBackup('backup-20260101-000005', { id: user._id, name: 'boss' });

    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(row => row.name);
    assert.ok(!names.some(name => /_restore_/.test(name)));
});

test('reset refuses to run without an actor id', async () => {
    await assert.rejects(() => catalogReset.resetCatalog({}), /actor id/);
    assert.strictEqual(await collections.Ingredient.countDocuments({}), 0);
});
