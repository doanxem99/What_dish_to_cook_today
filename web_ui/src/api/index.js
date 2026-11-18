import serverInfo from '../assets/js/server_info.js'

//server_info may or may not carry a trailing slash; one normalised base feeds every raw fetch.
export function serverBase(url = serverInfo.serverUrl) {
    return String(url).replace(/\/$/, '')
}

//One HTTP module. Errors become {status, message} so screens can render a state instead of throwing raw axios noise.
async function request(method, path, body) {
    const response = await fetch(serverBase() + path, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    })

    const text = await response.text()
    let data = null
    try {
        data = text ? JSON.parse(text) : null
    } catch (error) {
        data = text
    }

    if (!response.ok) {
        const plain = typeof data === 'string' ? data.trim() : ''
        const message = (data && (data.message || data.detail)) ||
            (plain ? plain.slice(0, 200) : `Request failed (${response.status})`)
        throw { status: response.status, message, data }
    }
    return data
}

export const api = {
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body === undefined ? {} : body),
    patch: (path, body) => request('PATCH', path, body === undefined ? {} : body),
    del: path => request('DELETE', path)
}

export default api
