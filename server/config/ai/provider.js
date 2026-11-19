//OpenAI-compatible chat adapter. OpenCode Go needs a per-conversation
//x-opencode-session header; Ollama speaks the same schema on /v1.
const providerError = (status, code, message, cause) => {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    if (cause) err.cause = cause;
    return err;
};

const baseUrlFor = (config) => {
    const raw = config.provider === 'ollama'
        ? `${config.ollamaUrl || 'http://localhost:11434'}/v1`
        : (config.baseUrl || '');
    return String(raw).replace(/\/+$/, '');
};

const headerValue = (headers, name) => {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    return headers[name] || '';
};

const wireTools = (tools) => (tools || []).map((tool) => ({
    type: 'function',
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} }
    }
}));

const wireMessages = (messages) => (messages || []).map((message) => {
    if (!message || !Array.isArray(message.tool_calls)) return message;
    return {
        ...message,
        tool_calls: message.tool_calls.map((call) => ({
            ...call,
            type: 'function',
            function: {
                ...call.function,
                arguments: typeof call.function.arguments === 'string'
                    ? call.function.arguments
                    : JSON.stringify(call.function.arguments || {})
            }
        }))
    };
});

const parseArguments = (raw) => {
    if (raw && typeof raw === 'object') return raw;
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
};

const mapToolCalls = (calls) => (calls || []).map((call) => ({
    id: call.id,
    name: call.function && call.function.name,
    arguments: parseArguments(call.function && call.function.arguments)
}));

const listModels = async (config, fetchImpl = fetch) => {
    try {
        const response = await fetchImpl(`${baseUrlFor(config)}/models`, { method: 'GET' });
        if (!response.ok) return { ok: false, models: [] };
        const payload = await response.json();
        const rows = payload.data || payload.models || [];
        const models = rows
            .map((row) => (typeof row === 'string' ? row : row && (row.id || row.name)))
            .filter(Boolean);
        return { ok: true, models };
    } catch {
        return { ok: false, models: [] };
    }
};

async function* bodyChunks(body) {
    if (!body) return;
    if (typeof body.getReader === 'function') {
        const reader = body.getReader();
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                yield value;
            }
        } finally {
            reader.releaseLock();
        }
        return;
    }
    for await (const chunk of body) yield chunk;
}

const readStream = async ({ response, config, onToken }) => {
    const decoder = new TextDecoder();
    let content = '';
    let buffer = '';
    let usage = null;
    const callsByIndex = new Map();

    const consumeLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const raw = trimmed.slice(5).trim();
        if (!raw || raw === '[DONE]') return;
        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            return;
        }
        if (payload.usage) usage = payload.usage;
        const choice = payload.choices && payload.choices[0];
        if (!choice) return;
        const delta = choice.delta || choice.message || {};
        if (delta.content) {
            content += delta.content;
            if (onToken) onToken(delta.content);
        }
        for (const part of delta.tool_calls || []) {
            const index = part.index || 0;
            const current = callsByIndex.get(index) || { id: '', function: { name: '', arguments: '' } };
            if (part.id) current.id = part.id;
            if (part.function && part.function.name) current.function.name += part.function.name;
            if (part.function && part.function.arguments) current.function.arguments += part.function.arguments;
            callsByIndex.set(index, current);
        }
    };

    for await (const chunk of bodyChunks(response.body)) {
        buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
            consumeLine(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf('\n');
        }
    }
    if (buffer) consumeLine(buffer);

    return {
        content,
        toolCalls: mapToolCalls([...callsByIndex.values()]),
        tokensIn: (usage && usage.prompt_tokens) || 0,
        tokensOut: (usage && usage.completion_tokens) || 0,
        model: config.model
    };
};

const chatCompletion = async ({
    config,
    sessionId,
    messages,
    tools,
    onToken,
    signal,
    fetchImpl = fetch
}) => {
    if (config.provider === 'opencode-go' && !sessionId) {
        throw new Error('x-opencode-session is required for the opencode-go provider');
    }

    const headers = { 'content-type': 'application/json' };
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    if (config.provider === 'opencode-go') headers['x-opencode-session'] = sessionId;

    const body = { model: config.model, messages: wireMessages(messages) };
    if (tools && tools.length) body.tools = wireTools(tools);
    if (onToken) body.stream = true;

    let response;
    try {
        response = await fetchImpl(`${baseUrlFor(config)}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal
        });
    } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        throw providerError(503, 'provider_down', 'AI provider is unreachable', err);
    }

    if (!response.ok) {
        const status = Number(response.status) || 0;
        if (status === 0 || status === 502 || status === 503 || status === 504) {
            throw providerError(503, 'provider_down', 'AI provider is unavailable');
        }
        throw providerError(502, 'provider_error', `AI provider returned ${status}`);
    }

    const contentType = headerValue(response.headers, 'content-type');
    const isJson = /application\/json/i.test(contentType);

    if (!isJson && (onToken || /text\/event-stream/i.test(contentType))) {
        return readStream({ response, config, onToken });
    }

    const payload = await response.json();
    const choice = (payload.choices && payload.choices[0]) || {};
    const message = choice.message || {};
    const usage = payload.usage || {};
    const content = message.content || '';
    if (onToken && content) onToken(content);

    return {
        content,
        toolCalls: mapToolCalls(message.tool_calls),
        tokensIn: usage.prompt_tokens || 0,
        tokensOut: usage.completion_tokens || 0,
        model: payload.model || config.model
    };
};

module.exports = {
    listModels,
    chatCompletion
};
