const test = require('node:test');
const assert = require('node:assert');
const { runIndexJob } = require('../config/ai/index_job');
const embeddings = require('../config/ai/embeddings');

test('a full index job says how much is current even when nothing changed', async () => {
    const original = embeddings.rebuildIndex;
    embeddings.rebuildIndex = async () => ({
        dish: 13, dish_post: 13, ingredient: 38, doc: 2, deleted: 0, embedded: 0
    });
    try {
        const detail = await runIndexJob({ payload: { full: true } });
        assert.match(detail, /index current: 66 rows/);
        assert.match(detail, /13 dish/);
        assert.match(detail, /0 embedded/);
        assert.match(detail, /0 removed/);
    } finally {
        embeddings.rebuildIndex = original;
    }
});
