const test = require('node:test');
const assert = require('node:assert');
const { enforceGrounding } = require('../config/ai/chat');

test('meta sentences about the rules are dropped from the reply', () => {
    const out = enforceGrounding(
        "Egg fried rice works with your egg. Wait - I shouldn't write URLs. Let me redo without URLs.",
        [{ name: 'search_dishes', output: { dishes: [{ name: 'Egg fried rice', dish_id: '1' }] } }],
        [{ name: 'Egg fried rice', name_vi: 'Cơm chiên trứng' }],
        []
    );
    assert.ok(!/shouldn't write URLs/i.test(out.text));
    assert.ok(/Egg fried rice/.test(out.text));
});
