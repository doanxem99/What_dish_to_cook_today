const { mongoose, collections } = require('../database/connection');
const { loadCatalog } = require('../catalog');
const { setMaintenance } = require('./maintenance');
const { FORMAT, VERSION, CATALOG_COLLECTIONS, createBackup, readBackup, fromExportDoc } = require('./backups');

const actorIdOf = function(actor) {
    const source = actor || {};
    return String(source.id || source._id || '');
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
const seedCatalog = async function(userId) {
    const catalog = loadCatalog();
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

//Dropping a collection also drops its indexes; the four unique ones must come back.
const recreateUniqueIndexes = async function() {
    await collections.User.createIndexes();
    await collections.Role.createIndexes();
    await collections.Vote.createIndexes();
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
    //A backup first: a failed write aborts before anything is dropped.
    const backup = await createBackup({ trigger: 'reset', actor });
    await setMaintenance(true, 'catalog reset', actor);
    try {
        for (const name of CATALOG_COLLECTIONS) {
            await dropCollection(name);
        }
        await seedCatalog(actorIdOf(actor));
        await recreateUniqueIndexes();
        return `reset complete, backup ${backup.file}`;
    } finally {
        await setMaintenance(false, 'catalog reset finished', actor);
    }
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

const swapCollection = async function(name, rows) {
    const db = mongoose.connection.db;
    const docs = rows.map(fromExportDoc);
    const temporary = `${name}_restore_${Date.now()}`;
    await dropCollection(temporary);
    await db.createCollection(temporary);
    if (docs.length > 0) {
        await db.collection(temporary).insertMany(docs);
    }
    try {
        await db.admin().command({
            renameCollection: `${db.databaseName}.${temporary}`,
            to: `${db.databaseName}.${name}`,
            dropTarget: true
        });
    } catch (error) {
        //shortcut: renameCollection needs admin privileges; without them the target is empty between drop and insert.
        await dropCollection(name);
        if (docs.length > 0) {
            await db.collection(name).insertMany(docs);
        }
        await dropCollection(temporary);
    }
};

const restoreBackup = async function(id, actor) {
    //Current data first: even a rejected archive leaves a fresh backup behind.
    const backup = await createBackup({ trigger: 'restore', actor });
    await setMaintenance(true, 'catalog restore', actor);
    try {
        const source = validateArchive(await readBackup(id));
        //Only the six catalog collections are written; user, audit_log and admin_job are ignored.
        for (const name of CATALOG_COLLECTIONS) {
            await swapCollection(name, source[name]);
        }
        await recreateUniqueIndexes();
        return `restored ${id}, previous data saved to ${backup.file}`;
    } finally {
        await setMaintenance(false, 'catalog restore finished', actor);
    }
};

module.exports = { resetCatalog, restoreBackup, recreateUniqueIndexes };
