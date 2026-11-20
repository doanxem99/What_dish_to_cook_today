//Conversation mode inference. The user types one sentence; this picks cook,
//walkthrough or help. Rules win first, then a cheap embedding comparison, then a
//default based on the request context. No classifier model call.
const embeddings = require('./embeddings');

const MODES = ['cook', 'walkthrough', 'help'];

//A prototype mean below this is noise; the default mode is a safer answer.
const THRESHOLD = 0.62;

//Both languages are always scored: a cook may type Vietnamese while the UI is English.
const KEYWORDS = {
    cook: [
        'what can i cook', 'what should i cook', 'what to cook', 'what do i cook',
        'ingredients i have', 'i have', 'in my pantry', 'pantry', 'leftovers',
        'use up', 'suggest a dish', 'suggest a meal', 'dinner tonight',
        'nấu gì', 'nau gi', 'nguyên liệu', 'nguyen lieu', 'tôi có', 'toi co',
        'trong bếp', 'trong bep', 'ăn gì', 'an gi', 'món gì', 'mon gi'
    ],
    walkthrough: [
        'how do i cook', 'how to cook', 'walk me through', 'step by step',
        'what are the steps', 'recipe for', 'how long do i', 'how long should i',
        'cooking method', 'instructions for',
        'cách nấu', 'cach nau', 'các bước', 'cac buoc', 'hướng dẫn nấu',
        'huong dan nau', 'từng bước', 'tung buoc', 'nấu bao lâu', 'nau bao lau',
        'cách làm', 'cach lam'
    ],
    help: [
        'how do i add', 'how do i create', 'how do i vote', 'how do i comment',
        'how do i sign', 'how do i log', 'how do i report', 'my account',
        'sign in', 'log in', 'password', 'leaderboard', 'ranking board',
        'the board', 'points', 'how does the site',
        'thêm món', 'them mon', 'bình chọn', 'binh chon', 'bình luận',
        'binh luan', 'tài khoản', 'tai khoan', 'đăng nhập', 'dang nhap',
        'bảng xếp hạng', 'bang xep hang', 'tạo món', 'tao mon', 'điểm'
    ]
};

//Six short sentences per mode: enough signal without a slow first request.
const PROTOTYPES = {
    en: {
        cook: [
            'I have eggs and rice, what can I cook tonight?',
            'What dish can I make from the ingredients in my pantry?',
            'Which recipe uses tomatoes, onions and chicken?',
            'I want to use up leftover vegetables.',
            'Suggest a dinner I can cook with what I already have.',
            'What should I cook today?'
        ],
        walkthrough: [
            'How do I cook this dish step by step?',
            'Walk me through the steps for making soup.',
            'What are the instructions for this recipe?',
            'How long should I boil the noodles?',
            'Show me the cooking method for this meal.',
            'Teach me how to prepare this dish.'
        ],
        help: [
            'How do I add a new dish to the site?',
            'How do I vote for a dish or comment on a post?',
            'Where is my account page and how do I sign in?',
            'How does the ranking board work?',
            'What do points mean on a dish post?',
            'How do I create an ingredient entry?'
        ]
    },
    vi: {
        cook: [
            'Tôi có trứng và cơm, hôm nay nấu gì?',
            'Món nào nấu được từ nguyên liệu trong bếp?',
            'Gợi ý món ăn từ những gì tôi có sẵn.',
            'Có cà chua và thịt gà thì nấu gì?',
            'Tôi muốn dùng hết rau còn lại.',
            'Hôm nay ăn gì?'
        ],
        walkthrough: [
            'Cách nấu món này như thế nào?',
            'Hướng dẫn tôi các bước làm món canh.',
            'Làm thế nào để nấu món này từng bước?',
            'Nấu bao lâu thì chín?',
            'Chỉ tôi công thức và cách làm.',
            'Các bước thực hiện món ăn này ra sao?'
        ],
        help: [
            'Làm sao để thêm món mới?',
            'Bình chọn và bình luận cho món ăn thế nào?',
            'Tôi muốn tạo tài khoản và đăng nhập.',
            'Bảng xếp hạng hoạt động ra sao?',
            'Điểm của bài viết món có ý nghĩa gì?',
            'Làm sao để thêm nguyên liệu mới?'
        ]
    }
};

const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

//Prototype vectors never change inside one process, so the first inference pays
//for them. An injected embedder (tests) keeps its own cache per function.
const defaultVectors = new Map();
const injectedVectors = new WeakMap();

const cacheFor = (embedFn) => {
    if (!embedFn) return defaultVectors;
    let map = injectedVectors.get(embedFn);
    if (!map) {
        map = new Map();
        injectedVectors.set(embedFn, map);
    }
    return map;
};

const scoreRules = (message) => {
    const text = normalize(message);
    const scores = { cook: 0, walkthrough: 0, help: 0 };
    for (const mode of MODES) {
        for (const keyword of KEYWORDS[mode]) {
            if (text.includes(keyword)) scores[mode] += 1;
        }
    }
    return scores;
};

//A unique top score wins; a tie means the sentence mixed two goals.
const ruleWinner = (scores) => {
    const top = Math.max(...MODES.map((mode) => scores[mode]));
    if (top <= 0) return null;
    const winners = MODES.filter((mode) => scores[mode] === top);
    return winners.length === 1 ? winners[0] : null;
};

const meanSimilarity = (query, vectors) => {
    if (vectors.length === 0) return 0;
    const sum = vectors.reduce((total, vector) => total + embeddings.cosineSimilarity(query, vector), 0);
    return sum / vectors.length;
};

const vectorFor = async (text, embed, injected) => {
    const cache = cacheFor(injected);
    if (cache.has(text)) return cache.get(text);
    const vector = await embed(text);
    cache.set(text, vector);
    return vector;
};

const defaultMode = (context) => {
    const count = Number(context && context.pantry_count);
    return Number.isFinite(count) && count > 0 ? 'cook' : 'help';
};

const inferMode = async ({ message = '', locale = 'en', context = {}, embedFn, signal, config } = {}) => {
    const winner = ruleWinner(scoreRules(message));
    if (winner) return { mode: winner, source: 'rules' };

    const fallback = defaultMode(context);
    const language = locale === 'vi' ? 'vi' : 'en';
    const embed = embedFn || ((text) => embeddings.embedText(text, { config, signal }));
    try {
        const query = await embed(message);
        if (!Array.isArray(query)) return { mode: fallback, source: 'default' };
        let best = { mode: fallback, score: 0 };
        for (const mode of MODES) {
            const vectors = [];
            for (const text of PROTOTYPES[language][mode]) {
                vectors.push(await vectorFor(text, embed, embedFn));
            }
            const score = meanSimilarity(query, vectors);
            if (score > best.score) best = { mode, score };
        }
        return best.score >= THRESHOLD
            ? { mode: best.mode, source: 'embedding' }
            : { mode: fallback, source: 'default' };
    } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        //The embedder is optional; a dead service must not block the answer.
        return { mode: fallback, source: 'default' };
    }
};

module.exports = {
    inferMode,
    KEYWORDS,
    MODES,
    PROTOTYPES,
    THRESHOLD
};
