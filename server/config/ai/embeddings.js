//Embeddings for the assistant corpus. Vectors come from a local Ollama model and
//live in ai_embedding; the source hash keeps unchanged rows out of the embedder.
//
//The docs corpus is a strict allowlist: PRODUCT.md, README.md and docs/help/*.md.
//Internal notes (docs/superpowers, docs/impl, docs/KNOWN_ISSUES.md, docs/ARCHITECTURE.md,
//docs/API.md, AGENTS.md, RULES.md) are never read, embedded or returned here.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { collections } = require('../database/connection');
const { readConfig } = require('./config');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXED_DOC_FILES = ['PRODUCT.md', 'README.md'];
const DOC_DIR = 'docs/help';
const ALLOWED_DOC_FILES = FIXED_DOC_FILES.concat([`${DOC_DIR}/*.md`]);

const repoRoot = () => (process.env.AI_DOC_ROOT ? path.resolve(process.env.AI_DOC_ROOT) : REPO_ROOT);

const toPosix = (value) => String(value).split(path.sep).join('/');

const listAllowedDocPaths = async () => {
    const root = repoRoot();
    const files = [];
    for (const relative of FIXED_DOC_FILES) {
        try {
            const stat = await fs.stat(path.join(root, relative));
            if (stat.isFile()) files.push(relative);
        } catch (error) {
            //A missing allowlisted file simply has nothing to embed.
        }
    }
    let entries = [];
    try {
        entries = await fs.readdir(path.join(root, DOC_DIR), { withFileTypes: true });
    } catch (error) {
        entries = [];
    }
    for (const entry of entries) {
        //Only plain .md files directly under docs/help.
        if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(`${DOC_DIR}/${entry.name}`);
        }
    }
    return files.sort();
};

//Returns null for any path outside the allowlist, including traversal attempts.
const readAllowedDoc = async (relativePath) => {
    const root = repoRoot();
    const requested = toPosix(String(relativePath || '')).replace(/^\.\//, '');
    if (!requested) return null;
    const allowed = await listAllowedDocPaths();
    const resolved = path.resolve(root, requested);
    const relative = toPosix(path.relative(root, resolved));
    if (!allowed.includes(relative)) return null;
    try {
        return await fs.readFile(resolved, 'utf8');
    } catch (error) {
        return null;
    }
};

const hashText = (text) => crypto.createHash('sha256').update(String(text)).digest('hex');

const blockText = (blocks, key) => {
    const parts = [];
    const walk = (value) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }
        if (typeof value === 'object') {
            const text = value[key];
            if (typeof text === 'string' && text.trim()) parts.push(text.trim());
            for (const child of Object.values(value)) {
                if (child && typeof child === 'object') walk(child);
            }
        }
    };
    walk(blocks);
    return parts.join(' ');
};

const ingredientNames = async (ids) => {
    const list = (ids || []).filter(Boolean);
    if (list.length === 0) return [];
    const rows = await collections.Ingredient.find({ _id: { $in: list } }, 'name name_vi');
    const byId = new Map(rows.map(row => [String(row._id), row]));
    return list.map(id => byId.get(String(id))).filter(Boolean);
};

const bestPostFor = async (dish, posts) => {
    const list = posts || await collections.DishPost.find({ dish_id: String(dish._id) });
    return list.find(post => String(post._id) === String(dish.best_post_id || ''))
        || list.find(post => post.is_best_post)
        || list[0]
        || null;
};

const dishPassages = async (dish) => {
    const posts = await collections.DishPost.find({ dish_id: String(dish._id) });
    const best = await bestPostFor(dish, posts);
    const comments = best
        ? await collections.Comment.find({ dish_post_id: String(best._id) }, 'body').limit(40)
        : [];
    const ingredients = best ? await ingredientNames(best.ingredients) : [];
    const en = [];
    const vi = [];
    if (dish.name) en.push(`Dish: ${dish.name}`);
    if (dish.name_vi) vi.push(`Món: ${dish.name_vi}`);
    if (best) {
        if (best.short_detail) en.push(best.short_detail);
        if (best.short_detail_vi) vi.push(best.short_detail_vi);
        const stepsEn = blockText(best.display_blocks, 'text');
        const stepsVi = blockText(best.display_blocks, 'text_vi');
        if (stepsEn) en.push(`Steps: ${stepsEn}`);
        if (stepsVi) vi.push(`Các bước: ${stepsVi}`);
    }
    if (ingredients.length > 0) {
        en.push(`Ingredients: ${ingredients.map(row => row.name).join(', ')}`);
        vi.push(`Nguyên liệu: ${ingredients.map(row => row.name_vi || row.name).join(', ')}`);
    }
    if (comments.length > 0) {
        const bodies = comments.map(row => row.body).filter(Boolean).join(' ');
        if (bodies) {
            en.push(`Comments: ${bodies}`);
            vi.push(`Bình luận: ${bodies}`);
        }
    }
    return [
        { locale: 'en', text: en.join('. ') },
        { locale: 'vi', text: vi.join('. ') }
    ];
};

const dishPostPassages = async (post) => {
    const comments = await collections.Comment.find({ dish_post_id: String(post._id) }, 'body').limit(40);
    const ingredients = await ingredientNames(post.ingredients);
    const en = [];
    const vi = [];
    if (post.name) en.push(`Dish post: ${post.name}`);
    if (post.name_vi) vi.push(`Bài viết món: ${post.name_vi}`);
    if (post.short_detail) en.push(post.short_detail);
    if (post.short_detail_vi) vi.push(post.short_detail_vi);
    const stepsEn = blockText(post.display_blocks, 'text');
    const stepsVi = blockText(post.display_blocks, 'text_vi');
    if (stepsEn) en.push(`Steps: ${stepsEn}`);
    if (stepsVi) vi.push(`Các bước: ${stepsVi}`);
    if (ingredients.length > 0) {
        en.push(`Ingredients: ${ingredients.map(row => row.name).join(', ')}`);
        vi.push(`Nguyên liệu: ${ingredients.map(row => row.name_vi || row.name).join(', ')}`);
    }
    if (comments.length > 0) {
        const bodies = comments.map(row => row.body).filter(Boolean).join(' ');
        if (bodies) {
            en.push(`Comments: ${bodies}`);
            vi.push(`Bình luận: ${bodies}`);
        }
    }
    return [
        { locale: 'en', text: en.join('. ') },
        { locale: 'vi', text: vi.join('. ') }
    ];
};

const ingredientPassages = async (ingredient) => {
    const post = ingredient.best_post_id
        ? await collections.IngredientPost.findById(ingredient.best_post_id)
        : await collections.IngredientPost.findOne({ ingredient_id: String(ingredient._id), is_best_post: true });
    const en = [];
    const vi = [];
    if (ingredient.name) en.push(`Ingredient: ${ingredient.name}`);
    if (ingredient.name_vi) vi.push(`Nguyên liệu: ${ingredient.name_vi}`);
    if (post) {
        if (post.short_detail) en.push(post.short_detail);
        if (post.short_detail_vi) vi.push(post.short_detail_vi);
        const textEn = blockText(post.display_blocks, 'text');
        const textVi = blockText(post.display_blocks, 'text_vi');
        if (textEn) en.push(textEn);
        if (textVi) vi.push(textVi);
    }
    return [
        { locale: 'en', text: en.join('. ') },
        { locale: 'vi', text: vi.join('. ') }
    ];
};

const docPassages = async (targetId) => {
    const text = await readAllowedDoc(targetId);
    if (text == null) return [];
    return [{ locale: 'en', text }];
};

const PASSAGE_BUILDERS = {
    dish: async (id) => {
        const dish = await collections.Dish.findById(id);
        if (!dish) return null;
        return dishPassages(dish);
    },
    dish_post: async (id) => {
        const post = await collections.DishPost.findById(id);
        if (!post) return null;
        return dishPostPassages(post);
    },
    ingredient: async (id) => {
        const ingredient = await collections.Ingredient.findById(id);
        if (!ingredient) return null;
        return ingredientPassages(ingredient);
    },
    doc: async (id) => docPassages(id)
};

//Extra rows that die with this target even when their own type is different.
const relatedDelete = async (targetType, targetId) => {
    if (targetType !== 'dish') return;
    const posts = await collections.DishPost.find({ dish_id: String(targetId) }, '_id');
    if (posts.length === 0) return;
    await collections.AiEmbedding.deleteMany({
        target_type: 'dish_post',
        target_id: { $in: posts.map(post => String(post._id)) }
    });
};

const syncTarget = async ({ targetType, targetId, embedFn, model }) => {
    const builder = PASSAGE_BUILDERS[targetType];
    if (!builder) throw new Error(`Unknown embedding target type ${targetType}`);
    const id = String(targetId);
    const embedModel = model || readConfig().embedModel;
    const passages = await builder(id);
    if (passages == null || passages.length === 0) {
        await collections.AiEmbedding.deleteMany({ target_type: targetType, target_id: id });
        await relatedDelete(targetType, id);
        return { target_type: targetType, target_id: id, embedded: 0, deleted: true };
    }

    let embedded = 0;
    const keptLocales = [];
    for (const passage of passages) {
        const text = String(passage.text || '').trim();
        if (!text) continue;
        keptLocales.push(passage.locale);
        const sourceHash = hashText(text);
        const existing = await collections.AiEmbedding.findOne({
            target_type: targetType,
            target_id: id,
            locale: passage.locale,
            model: embedModel
        });
        if (existing && existing.source_hash === sourceHash) continue;
        const vector = await embedFn(text);
        await collections.AiEmbedding.findOneAndUpdate(
            { target_type: targetType, target_id: id, locale: passage.locale, model: embedModel },
            {
                $set: {
                    source_hash: sourceHash,
                    text,
                    vector,
                    updated_at: new Date()
                }
            },
            { upsert: true, new: true }
        );
        embedded += 1;
    }
    if (keptLocales.length > 0) {
        await collections.AiEmbedding.deleteMany({
            target_type: targetType,
            target_id: id,
            locale: { $nin: keptLocales }
        });
    } else {
        await collections.AiEmbedding.deleteMany({ target_type: targetType, target_id: id });
    }
    return { target_type: targetType, target_id: id, embedded };
};

const rebuildIndex = async ({ embedFn, model }) => {
    const summary = { dish: 0, dish_post: 0, ingredient: 0, doc: 0, deleted: 0 };
    const desired = new Set();
    const remember = (targetType, targetId) => desired.add(`${targetType}:${targetId}`);

    const ingredients = await collections.Ingredient.find({}, '_id');
    for (const row of ingredients) {
        remember('ingredient', String(row._id));
        const result = await syncTarget({ targetType: 'ingredient', targetId: String(row._id), embedFn, model });
        summary.ingredient += result.embedded;
    }

    const dishes = await collections.Dish.find({}, '_id');
    for (const row of dishes) {
        remember('dish', String(row._id));
        const result = await syncTarget({ targetType: 'dish', targetId: String(row._id), embedFn, model });
        summary.dish += result.embedded;
    }

    const posts = await collections.DishPost.find({}, '_id dish_id');
    for (const row of posts) {
        remember('dish_post', String(row._id));
        const result = await syncTarget({ targetType: 'dish_post', targetId: String(row._id), embedFn, model });
        summary.dish_post += result.embedded;
    }

    const docs = await listAllowedDocPaths();
    for (const relative of docs) {
        remember('doc', relative);
        const result = await syncTarget({ targetType: 'doc', targetId: relative, embedFn, model });
        summary.doc += result.embedded;
    }

    //Orphans: rows whose source row or allowlisted file no longer exists.
    const rows = await collections.AiEmbedding.find({}, 'target_type target_id');
    for (const row of rows) {
        if (desired.has(`${row.target_type}:${row.target_id}`)) continue;
        await collections.AiEmbedding.deleteOne({ _id: row._id });
        summary.deleted += 1;
    }
    return summary;
};

// shortcut: switch to a vector index when the embedded row count passes ~20k
const cosineSimilarity = (vecA, vecB) => {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
        return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let index = 0; index < vecA.length; index += 1) {
        dot += vecA[index] * vecB[index];
        normA += vecA[index] * vecA[index];
        normB += vecB[index] * vecB[index];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const retrievePassages = async (queryText, options = {}) => {
    const { locale = 'en', limit = 6, embedFn } = options;
    if (typeof embedFn !== 'function') {
        return { passages: [], embedDown: true };
    }
    let queryVector;
    try {
        queryVector = await embedFn(queryText);
    } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        return { passages: [], embedDown: true };
    }
    if (!Array.isArray(queryVector)) {
        return { passages: [], embedDown: true };
    }

    const model = options.model || readConfig().embedModel;
    const rows = await collections.AiEmbedding.find({ model });
    const keyOf = (row) => `${row.target_type}:${row.target_id}`;
    const viKeys = new Set(rows.filter(row => row.locale === 'vi').map(keyOf));
    const candidates = rows.filter((row) => {
        if (locale === 'vi') {
            return row.locale === 'vi' || (row.locale === 'en' && !viKeys.has(keyOf(row)));
        }
        return row.locale === 'en';
    });

    const scored = candidates.map((row) => ({
        target_type: row.target_type,
        target_id: row.target_id,
        locale: row.locale,
        text: row.text,
        score: cosineSimilarity(queryVector, row.vector || [])
    })).filter(row => row.score > 0);
    scored.sort((left, right) => right.score - left.score);
    return { passages: scored.slice(0, Math.max(1, limit)), embedDown: false };
};

//A stalled Ollama must answer "embed_down" quickly, not hold the chat open.
//The bound is generous because a cold model load on CPU can take several seconds.
const EMBED_TIMEOUT_MS = 15000;

const embedAbortError = (message) => {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
};

//bge-m3 refuses input beyond its context; a long README heading would fail the whole index.
const MAX_EMBED_CHARS = 2000;

const embedText = async (text, options = {}) => {
    const config = options.config || readConfig();
    const fetchImpl = options.fetchImpl || fetch;
    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.max(1, options.timeoutMs)
        : (Number.isFinite(config.embedTimeoutMs) ? Math.max(1, config.embedTimeoutMs) : EMBED_TIMEOUT_MS);
    const requestSignal = options.signal || null;
    if (requestSignal && requestSignal.aborted) throw embedAbortError('Ollama embeddings aborted');

    const controller = new AbortController();
    let timer = null;
    let removeAbort = null;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            const error = new Error('Ollama embeddings timed out');
            error.name = 'TimeoutError';
            reject(error);
        }, timeoutMs);
    });
    const aborted = requestSignal
        ? new Promise((resolve, reject) => {
            const onAbort = () => {
                controller.abort();
                reject(embedAbortError('Ollama embeddings aborted'));
            };
            requestSignal.addEventListener('abort', onAbort, { once: true });
            removeAbort = () => requestSignal.removeEventListener('abort', onAbort);
        })
        : null;
    const request = (async () => {
        const base = String(config.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '');
        const response = await fetchImpl(`${base}/api/embeddings`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: config.embedModel, prompt: String(text).slice(0, MAX_EMBED_CHARS) }),
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`Ollama embeddings failed: ${response.status}`);
        }
        const payload = await response.json();
        const vector = payload.embedding
            || (Array.isArray(payload.embeddings) ? payload.embeddings[0] : null)
            || (Array.isArray(payload.data) && payload.data[0] ? payload.data[0].embedding : null);
        if (!Array.isArray(vector)) {
            throw new Error('Ollama returned no embedding vector');
        }
        return vector;
    })();

    try {
        return await Promise.race([request, timeout, ...(aborted ? [aborted] : [])]);
    } finally {
        clearTimeout(timer);
        if (removeAbort) removeAbort();
    }
};

const makeEmbedFn = (config, signal, timeoutMs) => (text) => embedText(text, { config, signal, timeoutMs });

module.exports = {
    ALLOWED_DOC_FILES,
    listAllowedDocPaths,
    readAllowedDoc,
    hashText,
    embedText,
    makeEmbedFn,
    cosineSimilarity,
    retrievePassages,
    syncTarget,
    rebuildIndex
};
