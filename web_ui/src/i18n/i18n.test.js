import { describe, expect, it } from 'vitest'
import { createTranslator } from './index.js'

const catalogs = {
    en: { 'home.title': 'Cook from what you already have', 'nav.home': 'Home' },
    vi: { 'home.title': 'Nấu từ những gì bạn đã có' }
}

function translator(locale) {
    return createTranslator(language => catalogs[language], () => locale)
}

describe('translator', () => {
    it('uses the active language', () => {
        expect(translator('vi')('home.title')).toBe('Nấu từ những gì bạn đã có')
    })

    it('falls back to English when the key is missing in the active language', () => {
        expect(translator('vi')('nav.home')).toBe('Home')
    })

    it('falls back to the key when no language has it', () => {
        expect(translator('vi')('missing.key')).toBe('missing.key')
    })

    it('replaces named parameters', () => {
        const t = createTranslator(() => ({ 'dishes.resultsFor': 'Results for “{q}”' }), () => 'en')
        expect(t('dishes.resultsFor', { q: 'bò' })).toBe('Results for “bò”')
    })
})
