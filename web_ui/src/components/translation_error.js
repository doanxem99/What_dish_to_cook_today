//Which message an editor shows after a failed /api/translate call. The server answers 503 when
//TRANSLATE_URL is unset and 502 when the endpoint is set but not answering.
export function translationFailure(status) {
    if (status === 503) return 'notConfigured'
    if (status === 502) return 'unreachable'
    return 'failed'
}
