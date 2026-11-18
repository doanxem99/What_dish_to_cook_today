//Which message an editor shows after a failed /api/translate call. The server answers 503 when
//TRANSLATE_URL is unset and 502 when the endpoint is set but not answering.
export function translationFailure(status) {
    if (status === 503) return 'notConfigured'
    if (status === 502) return 'unreachable'
    return 'failed'
}

export function translationFailureKey(status) {
    return 'edit.translate.' + translationFailure(status)
}

//A failure is worth showing only while its block is still in the list: the user may have removed
//it, or replaced it with a new block, before the answer arrived.
export function translationFailureFor(id, ids, status) {
    return ids.includes(id) ? translationFailureKey(status) : null
}

//A result belongs to the field that asked for it only while the source still holds the sent text
//and the target is still blank: the user may have edited either field during the request.
export function shouldApplyTranslation({ currentSource, requestSource, currentTarget }) {
    return currentSource === requestSource && !String(currentTarget || '').trim()
}
