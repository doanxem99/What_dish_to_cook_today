const { mongoose, collections } = require('../database/connection');
//Required as a module so a test can stub the loader.
const catalogModule = require('../catalog');
const { setMaintenance } = require('./maintenance');
const backups = require('./backups');
const { FORMAT, VERSION, CATALOG_COLLECTIONS, fromExportDoc } = backups;
const indexJob = require('../ai/index_job');

//No actor means no owner for the seeded posts, so fail before anything is dropped.
const actorIdOf = function(actor) {
    const source = actor || {};
    const id = String(source.id || source._id || '');
    if (!id) {
        throw new Error('A reset needs an actor id');
    }
    return id;
};

const round = function(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

//Same nutrition maths as scripts/dev-demo.mjs, so a reset does not change the public numbers.
const recipeNutrition = function(amounts, servings, nutritionData) {
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

//Repo owns the exact same fields scripts/dev-demo.mjs seeds. userId owns every seeded post.
const seedCatalog = async function(userId, catalog) {
    const db = mongoose.connection.db;
    const nutritionData = catalog.nutrition;
    const now = new Date();
    const ingredientIds = {};

    for (const row of catalog.ingredients) {
        const ingredientId = new mongoose.Types.ObjectId();
        const postId = new mongoose.Types.ObjectId();
        await db.collection('ingredient').insertOne({
            _id: ingredientId,
            name: row.name,
            name_vi: row.name_vi,
            best_post_id: postId.toString(),
            nutrition: row.nutrition,
            is_need_update: false
        });
        await db.collection('ingredient_post').insertOne({
            _id: postId,
            name: row.name,
            name_vi: row.name_vi,
            user_id: userId,
            ingredient_id: ingredientId.toString(),
            unique_id: `${ingredientId}_${userId}`,
            is_best_post: true,
            date_time: now,
            points: 0,
            type: row.type,
            nutrition: row.nutrition,
            short_detail: row.short_detail,
            short_detail_vi: row.short_detail_vi,
            profile_image: row.image || '',
            display_blocks: [{
                type: 'text',
                text: `${row.name} is kept in the shared catalog so every cook means the same thing.`,
                text_vi: `${row.name_vi} được lưu trong danh mục chung để mọi người hiểu cùng một nghĩa.`,
                font_size: 14,
                color: 'black'
            }]
        });
        ingredientIds[row.name] = ingredientId.toString();
    }

    for (const dish of catalog.dishes) {
        const dishId = new mongoose.Types.ObjectId();
        const postId = new mongoose.Types.ObjectId();
        await db.collection('dish').insertOne({
            _id: dishId,
            name: dish.name,
            name_vi: dish.name_vi,
            best_post_id: postId.toString(),
            is_need_update: false
        });
        await db.collection('dish_post').insertOne({
            _id: postId,
            name: dish.name,
            name_vi: dish.name_vi,
            user_id: userId,
            dish_id: dishId.toString(),
            unique_id: `${dishId}_${userId}`,
            is_best_post: true,
            date_time: now,
            points: 0,
            views: 0,
            comments: 0,
            ingredients: dish.ingredients.map(name => ingredientIds[name]).filter(Boolean),
            short_detail: dish.short_detail,
            short_detail_vi: dish.short_detail_vi,
            profile_image: dish.image || '',
            servings: dish.servings || null,
            nutrition: recipeNutrition(dish.amounts, dish.servings, nutritionData),
            ingredient_amounts: Object.entries(dish.amounts).map(([name, grams]) => ({
                ingredient_id: ingredientIds[name],
                grams
            })),
            display_blocks: dish.steps.map(step => ({
                type: 'text',
                text: step.text,
                text_vi: step.text_vi,
                font_size: 14,
                color: 'black'
            }))
        });
    }
};

//Dropping a collection also drops its indexes; each model already declares the ones it needs.
const recreateUniqueIndexes = async function() {
    await collections.User.createIndexes();
    await collections.Role.createIndexes();
    await collections.Vote.createIndexes();
    await collections.Ingredient.createIndexes();
    await collections.Dish.createIndexes();
    await collections.IngredientPost.createIndexes();
    await collections.DishPost.createIndexes();
};

const dropCollection = async function(name) {
    await mongoose.connection.db.collection(name).drop().catch((error) => {
        //A collection that never existed is already in the desired state.
        if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') {
            throw error;
        }
    });
};

const resetCatalog = async function(actor) {
    const actorId = actorIdOf(actor);
    //Load and validate before the flag and the first drop: a bad catalog changes nothing.
    const catalog = catalogModule.loadCatalog();
    const problems = catalogModule.validateCatalog(catalog);
    if (problems.length > 0) {
        throw new Error(`Catalog is invalid: ${problems.join('; ')}`);
    }
    //Public writes must stop before the backup, or they land in data the reset then destroys.
    await setMaintenance(true, 'catalog reset', actor);
    const backup = await backups.createBackup({ trigger: 'reset', actor });
    for (const name of CATALOG_COLLECTIONS) {
        await dropCollection(name);
    }
    await seedCatalog(actorId, catalog);
    await recreateUniqueIndexes();
    await setMaintenance(false, 'catalog reset finished', actor);
    indexJob.scheduleFullIfEnabled(actor);
    return `reset complete, backup ${backup.file}`;
};

const validateArchive = function(archive) {
    if (!archive || archive.format !== FORMAT) {
        throw new Error('Not a wdtct-backup archive');
    }
    if (archive.version !== VERSION) {
        throw new Error(`Unsupported backup version ${archive.version}`);
    }
    const source = archive.collections || {};
    for (const name of CATALOG_COLLECTIONS) {
        if (!Array.isArray(source[name])) {
            throw new Error(`Backup is missing collection ${name}`);
        }
    }
    return source;
};

const HEX_ID = /^[0-9a-fA-F]{24}$/;

const isPlainObject = function(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
};

//Every document of every collection is checked before the first write, so a bad row changes nothing.
const validateDocuments = function(source) {
    for (const name of CATALOG_COLLECTIONS) {
        for (let index = 0; index < source[name].length; index += 1) {
            const doc = source[name][index];
            if (!isPlainObject(doc)) {
                throw new Error(`Backup collection ${name} row ${index} is not an object`);
            }
            if (typeof doc._id !== 'string' || !HEX_ID.test(doc._id)) {
                throw new Error(`Backup collection ${name} row ${index} has an invalid _id`);
            }
        }
    }
};

const STAGING_PATTERN = /_restore_\d+$/;

//A crash between staging and swap leaves temp collections behind; clear them before staging again.
const dropStaleStaging = async function() {
    const db = mongoose.connection.db;
    const rows = await db.listCollections({}, { nameOnly: true }).toArray();
    for (const row of rows) {
        if (STAGING_PATTERN.test(row.name)) {
            await dropCollection(row.name);
        }
    }
};

//Stage all six first, so targets differ only for the short rename loop that follows.
const stageCollections = async function(source) {
    const db = mongoose.connection.db;
    const suffix = Date.now();
    const staged = [];
    for (const name of CATALOG_COLLECTIONS) {
        const docs = source[name].map(fromExportDoc);
        const temporary = `${name}_restore_${suffix}`;
        await dropCollection(temporary);
        await db.createCollection(temporary);
        if (docs.length > 0) {
            await db.collection(temporary).insertMany(docs);
        }
        staged.push({ name, temporary, docs });
    }
    return staged;
};

//13/26 is what MongoDB answers when the caller may not rename across namespaces.
const isRenameRefused = function(error) {
    return error.code === 13 || error.code === 26
        || error.codeName === 'Unauthorized' || error.codeName === 'NamespaceNotFound';
};

//Staging is complete before this runs, so the fallback never drops a target for a partial copy.
//Every rename is attempted: one failure must not leave the later collections on the old data.
const swapCollections = async function(staged) {
    const db = mongoose.connection.db;
    const failures = [];
    for (const { name, temporary, docs } of staged) {
        try {
            await db.admin().command({
                renameCollection: `${db.databaseName}.${temporary}`,
                to: `${db.databaseName}.${name}`,
                dropTarget: true
            });
        } catch (error) {
            if (!isRenameRefused(error)) {
                failures.push(`${name}: ${error.message}`);
                continue;
            }
            //shortcut: without admin rights the target is empty between drop and insert.
            await dropCollection(name);
            if (docs.length > 0) {
                await db.collection(name).insertMany(docs);
            }
            await dropCollection(temporary);
        }
    }
    if (failures.length > 0) {
        throw new Error(`Restore could not swap ${failures.length} collection(s): ${failures.join('; ')}`);
    }
};

const restoreBackup = async function(id, actor) {
    //Public writes must stop before the backup as well.
    await setMaintenance(true, 'catalog restore', actor);
    //Current data first: even a rejected archive leaves a fresh backup behind.
    //keepId spares the archive being restored when the prune would otherwise reach it.
    const backup = await backups.createBackup({ trigger: 'restore', actor, keepId: id });
    const source = validateArchive(await backups.readBackup(id));
    validateDocuments(source);
    await dropStaleStaging();
    const staged = await stageCollections(source);
    await swapCollections(staged);
    //Only the six catalog collections are written; user, audit_log and admin_job are ignored.
    await recreateUniqueIndexes();
    await setMaintenance(false, 'catalog restore finished', actor);
    indexJob.scheduleFullIfEnabled(actor);
    return `restored ${id}, previous data saved to ${backup.file}`;
};

module.exports = { resetCatalog, restoreBackup, recreateUniqueIndexes };
