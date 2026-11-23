const test = require('node:test');
const assert = require('node:assert');
const { enforceGrounding } = require('../config/ai/chat');

const catalog = [{ name: 'Broken rice with pork', name_vi: 'Cơm tấm' }, { name: 'Egg fried rice', name_vi: 'Cơm chiên trứng' }];
const results = [{ name: 'search_dishes', output: { dishes: [{ name: 'Broken rice with pork', dish_id: '1' }, { name: 'Egg fried rice', dish_id: '2' }] } }];

test('a stripped dish link leaves no dangling connector', () => {
    const out = enforceGrounding(
        'Broken rice with pork at /dish_detail?dish_id=1. Add an egg on top.',
        results,
        catalog,
        []
    );
    assert.ok(!/\bat\s*[.,]/.test(out.text), out.text);
    assert.ok(!/dish_detail/.test(out.text), out.text);
    assert.ok(/Add an egg on top\./.test(out.text), out.text);
});

test('a dropped sentence does not leave a lowercase start or double space', () => {
    const out = enforceGrounding(
        'Egg fried rice works. Poison Soup is better. use it tonight.',
        results,
        catalog,
        []
    );
    assert.ok(!/Poison Soup/.test(out.text), out.text);
    assert.ok(/Use it tonight\./.test(out.text), out.text);
    assert.ok(!/ {2,}/.test(out.text), out.text);
});
