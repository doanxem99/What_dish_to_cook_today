const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { resolveInside } = require('../config/file/file_action');

const root = path.join(__dirname, '..');

test('resolveInside keeps normal paths inside the root', () => {
    assert.strictEqual(
        resolveInside(root, 'public/gallery/temporary/1/0.png'),
        path.join(root, 'public/gallery/temporary/1/0.png')
    );
});

test('resolveInside rejects paths that leave the root', () => {
    assert.strictEqual(resolveInside(root, '../../secret.txt'), null);
    assert.strictEqual(resolveInside(root, 'public/../../secret.txt'), null);
    assert.strictEqual(resolveInside(root, 'public/../../../secret.txt'), null);
});
