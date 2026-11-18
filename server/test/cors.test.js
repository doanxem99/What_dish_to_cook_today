const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const { once } = require('node:events');

//Set before the module is loaded: allowedOrigins is read once at require time.
process.env.CORS_ORIGINS = 'https://dishes.example';
const { corsForRequest } = require('../config/cors');

let server;
let baseUrl;

test.before(async () => {
    const app = express();
    app.use((req, res, next) => corsForRequest()(req, res, next));
    app.get('/api/ping', (req, res) => res.send({ ok: true }));
    app.use((err, req, res, next) => res.status(err.status || 500).send(err.message));

    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test('a configured origin is allowed', async () => {
    const response = await fetch(`${baseUrl}/api/ping`, { headers: { origin: 'https://dishes.example' } });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('access-control-allow-origin'), 'https://dishes.example');
});

test('an unlisted origin is refused with 403', async () => {
    const response = await fetch(`${baseUrl}/api/ping`, { headers: { origin: 'https://evil.example' } });

    assert.strictEqual(response.status, 403);
});

test('a request without an Origin header is allowed', async () => {
    const response = await fetch(`${baseUrl}/api/ping`);

    assert.strictEqual(response.status, 200);
});

test('a forged Host header does not allow an unlisted origin', async () => {
    const status = await new Promise((resolve, reject) => {
        const request = http.request({
            hostname: '127.0.0.1',
            port: server.address().port,
            path: '/api/ping',
            headers: { origin: 'https://evil.example', host: 'evil.example' },
        }, (response) => {
            response.resume();
            resolve(response.statusCode);
        });
        request.on('error', reject);
        request.end();
    });

    assert.strictEqual(status, 403);
});
