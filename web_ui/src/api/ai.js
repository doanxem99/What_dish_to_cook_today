import { ref } from 'vue'
import { api, serverBase } from './index.js'
import { parseSseBuffer } from '../components/ask_format.js'

//The stream reader is a plain fetch: the shared api client reads whole bodies and SSE must
//stay incremental. Aborting the controller also closes the server request, so quota is kept.
async function streamChat({ message, mode, capability, locale, dishId, pantryCount, signal, onEvent }) {
    //`mode` is omitted unless the user overrode the inferred goal; the server then infers it.
    //dish_id and pantry_count are the two facts the server cannot see itself.
    const body = { message, mode, capability, locale }
    if (dishId) body.dish_id = dishId
    if (typeof pantryCount === 'number') body.pantry_count = pantryCount
    const response = await fetch(serverBase() + '/api/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal
    })

    if (!response.ok) {
        let payload = null
        try {
            payload = await response.json()
        } catch (error) {
            payload = null
        }
        const detail = payload && payload.error ? payload.error : {}
        throw {
            status: response.status,
            code: detail.code || '',
            message: detail.message || `Request failed (${response.status})`
        }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const flush = () => {
        const { events, remainder } = parseSseBuffer(buffer)
        buffer = remainder
        for (const entry of events) {
            if (typeof onEvent === 'function') onEvent(entry)
        }
    }

    while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        flush()
    }
    buffer += decoder.decode()
    if (buffer.trim()) {
        buffer += '\n\n'
        flush()
    }
}

export const aiApi = {
    status: () => api.get('/api/ai/status'),
    conversation: () => api.get('/api/ai/conversation'),
    clearConversation: () => api.del('/api/ai/conversation'),
    setCapability: capability => api.post('/api/ai/capability', { capability }),
    //Browsing must never fail because history is unavailable.
    recordEvent: async (type, targetId, dishPostId) => {
        if (!type || !targetId) return null
        const body = { type, target_id: String(targetId) }
        if (dishPostId) body.dish_post_id = String(dishPostId)
        try {
            return await api.post('/api/ai/events', body)
        } catch (error) {
            return null
        }
    },
    listEvents: page => api.get(`/api/ai/events?page=${Math.max(1, Number(page) || 1)}`),
    clearEvents: () => api.del('/api/ai/events'),
    streamChat
}

export default aiApi

//One probe per page load decides whether the Ask entry is rendered at all. A 404 means the
//server has AI_ENABLED off; any other failure keeps the entry so a temporary outage is visible
//inside the panel instead of silently removing the feature.
export const askAvailable = ref(false)
let availabilityProbe = null
export function ensureAskAvailable() {
    if (availabilityProbe) return availabilityProbe
    availabilityProbe = aiApi.status()
        .then(() => { askAvailable.value = true })
        .catch((error) => { askAvailable.value = (error && error.status) !== 404 })
        .then(() => askAvailable.value)
    return availabilityProbe
}
