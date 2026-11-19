//Pure helpers for the Ask panel. Links are built only from validated tool ids, never from
//model prose, so a hallucinated URL cannot become a clickable link.

const OBJECT_ID = /^[a-f0-9]{24}$/i
const SAFE_ACTION_LINK = /^\/(?:dish_detail\?dish_id=|ingredient_detail\?ingredient_id=)[a-f0-9]{24}$/i

const TOOL_KEYS = {
    search_dishes: 'ask.tool.searchDishes',
    get_dish: 'ask.tool.getDish',
    get_help: 'ask.tool.getHelp',
    select_ingredients: 'ask.tool.selectIngredients',
    open_dish: 'ask.tool.openDish',
    start_draft: 'ask.tool.startDraft'
}

const EVENT_KEYS = {
    dish_viewed: 'profile.event.dish_viewed',
    dish_cooked: 'profile.event.dish_cooked',
    ingredient_picked: 'profile.event.ingredient_picked',
    chat_message: 'profile.event.chat_message'
}

export function validateMessageInput(text) {
    const value = typeof text === 'string' ? text.trim() : ''
    return value.length >= 1 && value.length <= 2000
}

export function citationHref(citation) {
    const type = citation && citation.target_type
    const id = citation && citation.id
    if (!OBJECT_ID.test(String(id || ''))) {
        return ''
    }
    if (type === 'dish') {
        return '/dish_detail?dish_id=' + id
    }
    if (type === 'ingredient') {
        return '/ingredient_detail?ingredient_id=' + id
    }
    return ''
}

export function actionLink(action) {
    const link = action && action.link
    return typeof link === 'string' && SAFE_ACTION_LINK.test(link) ? link : ''
}

export function mergeCitations(existing, incoming) {
    const merged = Array.isArray(existing) ? [...existing] : []
    const seen = new Set(merged.filter(citationHref).map(entry => entry.target_type + ':' + entry.id))
    for (const citation of (Array.isArray(incoming) ? incoming : [])) {
        if (!citationHref(citation)) continue
        const key = citation.target_type + ':' + citation.id
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(citation)
    }
    return merged
}

export function toolSummaryKey(toolEvent) {
    if (toolEvent && toolEvent.summary && toolEvent.summary.error) {
        return 'ask.tool.failed'
    }
    const name = toolEvent && toolEvent.name
    return TOOL_KEYS[name] || 'ask.tool.generic'
}

export function toolSummaryParams(toolEvent) {
    const summary = (toolEvent && toolEvent.summary) || {}
    const count = [summary.dishes, summary.passages, summary.matched, summary.dish, summary.items]
        .find(value => typeof value === 'number')
    return { n: typeof count === 'number' ? count : 0 }
}

export function eventTypeKey(type) {
    return EVENT_KEYS[type] || 'profile.event.other'
}

export function eventTargetHref(event) {
    const id = event && event.target_id
    if (!OBJECT_ID.test(String(id || ''))) {
        return ''
    }
    if (event.type === 'ingredient_picked') {
        return '/ingredient_detail?ingredient_id=' + id
    }
    if (event.type === 'dish_viewed' || event.type === 'dish_cooked') {
        return '/dish_detail?dish_id=' + id
    }
    return ''
}

export function formatQuotaUsage(quota, t) {
    return t('profile.aiUsage', {
        used: Number(quota && quota.used) || 0,
        limit: Number(quota && quota.limit) || 0
    })
}

export function errorStateKey(status, code) {
    if (status === 429 || code === 'quota_reached') return 'ask.quotaReached'
    if (status === 403 || code === 'ai_disabled') return 'ask.disabled'
    if (status === 502 || status === 503 || code === 'provider_down' || code === 'provider_error') {
        return 'ask.providerDown'
    }
    return 'ask.error'
}

export function parseSseBuffer(buffer) {
    let rest = String(buffer || '')
    const events = []
    const splitter = /\r?\n\r?\n/
    let match = splitter.exec(rest)
    while (match) {
        const frame = rest.slice(0, match.index)
        rest = rest.slice(match.index + match[0].length)
        const parsed = readFrame(frame)
        if (parsed) events.push(parsed)
        match = splitter.exec(rest)
    }
    return { events, remainder: rest }
}

export const parseSseChunk = parseSseBuffer

function readFrame(frame) {
    let name = 'message'
    const dataLines = []
    for (const raw of frame.split(/\r?\n/)) {
        if (!raw || raw.startsWith(':')) continue
        const colon = raw.indexOf(':')
        const field = colon === -1 ? raw : raw.slice(0, colon)
        let value = colon === -1 ? '' : raw.slice(colon + 1)
        if (value.startsWith(' ')) value = value.slice(1)
        if (field === 'event') name = value
        if (field === 'data') dataLines.push(value)
    }
    if (dataLines.length === 0) return null
    const payload = dataLines.join('\n')
    try {
        return { event: name, data: JSON.parse(payload) }
    } catch (error) {
        return { event: name, data: payload }
    }
}
