//Bounded catalog and help tools. Every dish and ingredient the assistant can name is
//read from MongoDB here; the model only chooses which tool to call.
const { collections } = require('../database/connection');
const embeddings = require('./embeddings');
const events = require('./events');

const HEX_ID = /^[0-9a-f]{24}$/i;

const TOOL_DEFINITIONS = [
    {
        name: 'search_dishes',
        description: 'Rank catalog dishes by the ingredients the cook has. Returns real dish ids only.',
        parameters: {
            type: 'object',
            properties: {
                ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredient names in English or Vietnamese' },
                query: { type: 'string', description: 'Free-text hint such as "warm noodles"' },
                limit: { type: 'integer', minimum: 1, maximum: 10 }
            }
        }
    },
    {
        name: 'get_dish',
        description: 'Read one dish: steps, amounts, servings, nutrition, image and link.',
        parameters: {
            type: 'object',
            properties: {
                dish_id: { type: 'string', description: 'Catalog dish id or dish name' }
            },
            required: ['dish_id']
        }
    },
    {
        name: 'get_help',
        description: 'Answer how-to questions from the curated help pages and catalog facts.',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'What the cook wants to know' }
            },
            required: ['topic']
        }
    },
    {
        name: 'select_ingredients',
        description: 'Match ingredient names to the catalog and preview a pantry selection.',
        parameters: {
            type: 'object',
            properties: {
                names: { type: 'array', items: { type: 'string' } }
            },
            required: ['names']
        }
    },
    {
        name: 'open_dish',
        description: 'Return a validated link to a dish page.',
        parameters: {
            type: 'object',
            properties: {
                dish_id: { type: 'string' }
            },
            required: ['dish_id']
        }
    },
    {
        name: 'start_draft',
        description: 'Prefill the dish editor. Never saves anything; the cook confirms.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } }
            },
            required: ['name']
        }
    }
];

const CAPABILITY_TOOLS = {
    read_only: ['search_dishes', 'get_dish', 'get_help'],
    prepare: ['search_dishes', 'get_dish', 'get_help', 'select_ingredients', 'start_draft'],
    act_freely: ['search_dishes', 'get_dish', 'get_help', 'select_ingredients', 'open_dish', 'start_draft']
};

const toolDefinitionsFor = (capability) => {
    const allowed = CAPABILITY_TOOLS[capability] || CAPABILITY_TOOLS.read_only;
    return TOOL_DEFINITIONS.filter(definition => allowed.includes(definition.name));
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const findIngredientsByName = async (names) => {
    const wanted = (Array.isArray(names) ? names : [])
        .map(normalize)
        .filter(Boolean);
    if (wanted.length === 0) return { items: [], unmatched: [] };
    const all = await collections.Ingredient.find({}, 'name name_vi');
    const byName = new Map();
    for (const row of all) {
        if (row.name) byName.set(normalize(row.name), row);
        if (row.name_vi) byName.set(normalize(row.name_vi), row);
    }
    const seen = new Set();
    const items = [];
    const unmatched = [];
    for (const name of wanted) {
        const row = byName.get(name);
        if (!row) {
            if (!unmatched.includes(name)) unmatched.push(name);
            continue;
        }
        const id = String(row._id);
        if (seen.has(id)) continue;
        seen.add(id);
        items.push({ id, name: row.name, name_vi: row.name_vi || '' });
    }
    return { items, unmatched };
};

const findDish = async (reference) => {
    const value = String(reference || '').trim();
    if (!value) return null;
    if (HEX_ID.test(value)) {
        const byId = await collections.Dish.findById(value);
        if (byId) return byId;
    }
    return collections.Dish.findOne({ $or: [{ name: value }, { name_vi: value }] });
};

const postForDish = async (dish) => {
    if (dish.best_post_id && HEX_ID.test(String(dish.best_post_id))) {
        const byId = await collections.DishPost.findById(String(dish.best_post_id));
        if (byId) return byId;
    }
    const best = await collections.DishPost.findOne({ dish_id: String(dish._id), is_best_post: true });
    if (best) return best;
    return collections.DishPost.findOne({ dish_id: String(dish._id) }).sort({ points: -1 });
};

const blocksToSteps = (blocks) => (Array.isArray(blocks) ? blocks : [])
    .filter(block => block && typeof block === 'object')
    .map(block => ({
        type: block.type || 'text',
        text: block.text || '',
        text_vi: block.text_vi || ''
    }))
    .filter(step => step.text || step.text_vi);

const searchDishes = async (args, ctx) => {
    const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
    const query = String(args.query || '').trim();
    const locale = ctx.locale === 'vi' ? 'vi' : 'en';
    const resolved = await findIngredientsByName(args.ingredients);
    const selectedIds = new Set(resolved.items.map(item => item.id));
    const signals = ctx.userId
        ? await events.loadUserSignals(ctx.userId).catch(() => ({ dishBoosts: new Map(), likedIngredientIds: new Set() }))
        : { dishBoosts: new Map(), likedIngredientIds: new Set() };

    let passages = [];
    if (query && typeof ctx.embedFn === 'function') {
        const retrieved = await embeddings.retrievePassages(query, { locale, limit: 10, embedFn: ctx.embedFn });
        passages = retrieved.passages;
    }
    const passageDishIds = new Set(passages.filter(row => row.target_type === 'dish').map(row => String(row.target_id)));
    const passagePostIds = passages.filter(row => row.target_type === 'dish_post').map(row => String(row.target_id));
    if (passagePostIds.length > 0) {
        const posts = await collections.DishPost.find({ _id: { $in: passagePostIds } }, 'dish_id');
        for (const post of posts) passageDishIds.add(String(post.dish_id));
    }

    const posts = await collections.DishPost.find({ is_best_post: true });
    const dishes = await collections.Dish.find({ _id: { $in: posts.map(post => post.dish_id).filter(Boolean) } });
    const dishById = new Map(dishes.map(dish => [String(dish._id), dish]));
    const ingredientById = new Map();
    const allIngredientIds = [...new Set(posts.flatMap(post => (post.ingredients || []).map(String)))];
    if (allIngredientIds.length > 0) {
        const rows = await collections.Ingredient.find({ _id: { $in: allIngredientIds } }, 'name name_vi');
        for (const row of rows) ingredientById.set(String(row._id), row);
    }

    const queryTokens = normalize(query).split(/\s+/).filter(Boolean);
    const ranked = [];
    for (const post of posts) {
        const dish = dishById.get(String(post.dish_id));
        if (!dish) continue;
        const ingredientIds = (post.ingredients || []).map(String);
        const matchedIds = ingredientIds.filter(id => selectedIds.has(id));
        const namesOf = (ids) => ids
            .map(id => ingredientById.get(id))
            .filter(Boolean)
            .map(row => (locale === 'vi' && row.name_vi ? row.name_vi : row.name));
        const reasons = [];
        let score = matchedIds.length * 10;
        if (selectedIds.size > 0 && matchedIds.length > 0) {
            reasons.push(`matched ${matchedIds.length} of ${ingredientIds.length} ingredients`);
        }
        const haystack = normalize([post.name, post.name_vi, post.short_detail, post.short_detail_vi].join(' '));
        const hits = queryTokens.filter(token => haystack.includes(token)).length;
        if (hits > 0) {
            score += hits * 5;
            reasons.push('matches your search');
        }
        const boost = signals.dishBoosts.get(String(dish._id));
        if (boost) {
            score += boost.score;
            reasons.push(...boost.reasons);
        }
        if (passageDishIds.has(String(dish._id))) {
            score += 3;
            reasons.push('related reading');
        }
        const missingIds = ingredientIds.filter(id => !selectedIds.has(id));
        ranked.push({
            score,
            dish_id: String(dish._id),
            name: dish.name,
            name_vi: dish.name_vi || '',
            short_detail: post.short_detail || '',
            short_detail_vi: post.short_detail_vi || '',
            match_count: matchedIds.length,
            total_ingredients: ingredientIds.length,
            matched_ingredients: namesOf(matchedIds),
            missing_ingredients: namesOf(missingIds),
            reasons,
            link: `/dish_detail?dish_id=${dish._id}`
        });
    }
    ranked.sort((left, right) => right.score - left.score || right.match_count - left.match_count
        || String(left.name).localeCompare(String(right.name)));
    return { dishes: ranked.slice(0, limit).map(({ score, ...dish }) => dish) };
};

const getDish = async (args) => {
    const dish = await findDish(args.dish_id);
    if (!dish) return { error: 'not_found' };
    const post = await postForDish(dish);
    const amounts = [];
    for (const row of (post && Array.isArray(post.ingredient_amounts) ? post.ingredient_amounts : [])) {
        const ingredient = row && row.ingredient_id
            ? await collections.Ingredient.findById(String(row.ingredient_id), 'name name_vi')
            : null;
        amounts.push({
            ingredient_id: row && row.ingredient_id ? String(row.ingredient_id) : '',
            name: ingredient ? ingredient.name : '',
            name_vi: ingredient ? ingredient.name_vi || '' : '',
            grams: row ? row.grams : null
        });
    }
    return {
        dish_id: String(dish._id),
        name: dish.name,
        name_vi: dish.name_vi || '',
        short_detail: post ? post.short_detail || '' : '',
        short_detail_vi: post ? post.short_detail_vi || '' : '',
        steps: post ? blocksToSteps(post.display_blocks) : [],
        amounts,
        servings: post ? post.servings : null,
        nutrition: post ? post.nutrition : null,
        profile_image: post ? post.profile_image || '' : '',
        link: `/dish_detail?dish_id=${dish._id}`
    };
};

const tokenize = (value) => normalize(value).match(/[\p{L}\p{N}]+/gu) || [];

const helpChunks = (text) => String(text || '')
    .split(/\n{2,}/)
    .map(chunk => chunk.replace(/^#+\s*/gm, '').trim())
    .filter(chunk => chunk.length > 40);

const getHelp = async (args) => {
    const topic = String(args.topic || '').trim();
    const topicTokens = new Set(tokenize(topic));
    const files = await embeddings.listAllowedDocPaths();
    const scored = [];
    for (const source of files) {
        const text = await embeddings.readAllowedDoc(source);
        if (text == null) continue;
        for (const chunk of helpChunks(text)) {
            const chunkTokens = new Set(tokenize(chunk));
            let score = 0;
            for (const token of topicTokens) {
                if (chunkTokens.has(token)) score += 1;
            }
            if (score > 0) scored.push({ source, text: chunk, score });
        }
    }
    scored.sort((left, right) => right.score - left.score);
    const passages = scored.slice(0, 3).map(({ source, text }) => ({ source, text }));

    if (/\b(dish|dishes|ingredient|ingredients|catalog|count|many)\b/i.test(topic)) {
        const [dishes, ingredients] = await Promise.all([
            collections.Dish.countDocuments({}),
            collections.Ingredient.countDocuments({})
        ]);
        passages.push({
            source: 'catalog',
            text: `The shared catalog currently lists ${dishes} dishes and ${ingredients} ingredients.`
        });
    }
    return { passages };
};

const selectIngredients = async (args, capability) => {
    const result = await findIngredientsByName(args.names);
    return {
        items: result.items,
        unmatched: result.unmatched,
        clientAction: {
            type: 'select_ingredients',
            apply: capability === 'act_freely',
            items: result.items
        }
    };
};

const openDish = async (args) => {
    const dish = await findDish(args.dish_id);
    if (!dish) return { error: 'not_found' };
    return {
        dish_id: String(dish._id),
        name: dish.name,
        name_vi: dish.name_vi || '',
        clientAction: {
            type: 'open_dish',
            apply: true,
            link: `/dish_detail?dish_id=${dish._id}`
        }
    };
};

const startDraft = async (args) => {
    const name = String(args.name || '').trim();
    const matched = await findIngredientsByName(args.ingredients);
    const prefill = { name, ingredients: matched.items };
    return {
        name,
        ingredients: matched.items,
        unmatched: matched.unmatched,
        //Saving stays a click the cook makes, in every capability.
        clientAction: { type: 'start_draft', apply: false, prefill }
    };
};

const executeTool = async (name, args, ctx = {}) => {
    const capability = ctx.capability || 'read_only';
    const allowed = CAPABILITY_TOOLS[capability] || CAPABILITY_TOOLS.read_only;
    if (!allowed.includes(name)) return { error: 'capability_denied' };
    const input = args && typeof args === 'object' ? args : {};
    switch (name) {
        case 'search_dishes':
            return searchDishes(input, ctx);
        case 'get_dish':
            return getDish(input);
        case 'get_help':
            return getHelp(input);
        case 'select_ingredients':
            return selectIngredients(input, capability);
        case 'open_dish':
            return openDish(input);
        case 'start_draft':
            return startDraft(input);
        default:
            return { error: 'capability_denied' };
    }
};

module.exports = {
    toolDefinitionsFor,
    executeTool
};
