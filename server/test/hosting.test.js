const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { once } = require('node:events');

const createStaticSite = require('../routes/web/static_site');

let tempRoot;
let server;
let baseUrl;

async function startWithFixtures() {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wdct-hosting-'));
    await fs.outputFile(path.join(tempRoot, 'vue', 'index.html'), '<div>vue-root</div>');
    await fs.outputFile(path.join(tempRoot, 'flutter', 'index.html'), '<div>flutter-root</div>');

    const app = express();
    app.get('/api/ping', (req, res) => res.send({ ok: true }));
    app.use(createStaticSite({
        vueRoot: path.join(tempRoot, 'vue'),
        flutterRoot: path.join(tempRoot, 'flutter'),
    }));

    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
}

test.before(startWithFixtures);

test.after(async () => {
    server.close();
    await fs.remove(tempRoot);
});

test('root serves the Vue app', async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /vue-root/);
});

test('a Vue client route falls back to the Vue app', async () => {
    const response = await fetch(`${baseUrl}/dishes`);
    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /vue-root/);
});

test('flutter is served under /flutter', async () => {
    const response = await fetch(`${baseUrl}/flutter/`);
    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /flutter-root/);
});

test('api routes are never swallowed by the fallback', async () => {
    const ping = await fetch(`${baseUrl}/api/ping`);
    assert.deepStrictEqual(await ping.json(), { ok: true });

    const missing = await fetch(`${baseUrl}/api/missing`);
    const text = await missing.text();
    assert.ok(!text.includes('vue-root'));
});

test('a missing asset answers 404 instead of the app shell', async () => {
    const response = await fetch(`${baseUrl}/assets/missing-hash.js`);
    const text = await response.text();

    assert.strictEqual(response.status, 404);
    assert.ok(!text.includes('vue-root'));
});

test('a missing flutter asset answers 404, not the flutter shell', async () => {
    const response = await fetch(`${baseUrl}/flutter/main.dart.js`);

    assert.strictEqual(response.status, 404);
});

test('the old /web path redirects to /flutter/', async () => {
    const response = await fetch(`${baseUrl}/web`, { redirect: 'manual' });

    assert.strictEqual(response.status, 301);
    assert.strictEqual(response.headers.get('location'), '/flutter/');
});

test('a flutter deep link loads the flutter shell', async () => {
    const response = await fetch(`${baseUrl}/flutter/dish_detail`);
    const text = await response.text();

    assert.strictEqual(response.status, 200);
    assert.match(text, /flutter-root/);
});

test('Dockerfile and docker-compose.yml include ollama and the help corpus allowlist', async () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const dockerfile = await fs.readFile(path.join(repoRoot, 'Dockerfile'), 'utf8');
    const compose = await fs.readFile(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
    const envExample = await fs.readFile(path.join(repoRoot, '.env.example'), 'utf8');

    assert.match(dockerfile, /COPY docs\/help\/ \/docs\/help/);
    assert.match(dockerfile, /COPY PRODUCT\.md README\.md \//);
    assert.match(compose, /ollama:/);
    assert.match(compose, /OLLAMA_URL:\s*\$\{OLLAMA_URL:-http:\/\/ollama:11434\}/);
    assert.match(envExample, /AI_MODEL=deepseek-v4\.1-flash/);
    assert.match(envExample, /EMBED_MODEL=bge-m3/);
});
