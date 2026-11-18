import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, serverBase } from './index.js'

function stubFetch(response) {
    globalThis.fetch = vi.fn(async () => response)
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('api', () => {
    it('returns parsed JSON on success', async () => {
        stubFetch({ ok: true, status: 200, text: async () => '{"status":0,"data":[1]}' })
        await expect(api.get('/api/x')).resolves.toEqual({ status: 0, data: [1] })
    })

    it('throws a status and message on failure', async () => {
        stubFetch({ ok: false, status: 500, text: async () => '{"message":"boom"}' })
        await expect(api.get('/api/x')).rejects.toMatchObject({ status: 500, message: 'boom' })
    })

    it('keeps a plain-text failure readable', async () => {
        stubFetch({ ok: false, status: 404, text: async () => 'Not found' })
        await expect(api.get('/api/x')).rejects.toMatchObject({ status: 404, message: 'Not found' })
    })

    it('sends credentials and JSON bodies', async () => {
        stubFetch({ ok: true, status: 200, text: async () => '{}' })
        await api.post('/api/x', { a: 1 })
        const [, options] = globalThis.fetch.mock.calls[0]
        expect(options.credentials).toBe('include')
        expect(options.method).toBe('POST')
        expect(options.body).toBe('{"a":1}')
    })

    it('normalises the server base with or without a trailing slash', () => {
        expect(serverBase('https://api.example')).toBe('https://api.example')
        expect(serverBase('https://api.example/')).toBe('https://api.example')
        expect(serverBase('https://api.example/') + '/api/x').toBe('https://api.example/api/x')
    })
})
