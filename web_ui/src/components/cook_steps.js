//Steps are the post's text blocks, in the current locale, with empty ones dropped.
export function stepTexts(blocks, locale) {
    const rows = (Array.isArray(blocks) ? blocks : [])
        .filter((block) => block && block.type === 'text')
        .map((block) => (locale === 'vi' && block.text_vi ? block.text_vi : block.text))
        .filter((text) => typeof text === 'string' && text.trim().length > 0)
    return rows.map((text) => text.trim())
}

//A dish with no written blocks still gets its one-line description as a step.
export function stepsFor(post, locale) {
    if (!post) return []
    const written = stepTexts(post.display_blocks, locale)
    if (written.length > 0) return written
    const fallback = locale === 'vi' && post.short_detail_vi ? post.short_detail_vi : post.short_detail
    return typeof fallback === 'string' && fallback.trim() ? [fallback.trim()] : []
}

export function formatClock(totalSeconds) {
    const total = Math.max(0, Math.floor(Number(totalSeconds) || 0))
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}
