import { ref } from 'vue'

const catalogs = { en: {}, vi: {} }
const locale = ref('en')

//Pure translator, also used by the tests: English first, then the key itself.
export function createTranslator(getCatalog, getLocale) {
    return function translate(key, params) {
        const active = getCatalog(getLocale()) || {}
        const fallback = getCatalog('en') || {}
        const value = active[key] ?? fallback[key] ?? key
        if (!params) {
            return value
        }
        return value.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? ''))
    }
}

const translate = createTranslator(l => catalogs[l], () => locale.value)

export async function loadCatalog(language) {
    if (catalogs[language] && Object.keys(catalogs[language]).length > 0) {
        return catalogs[language]
    }
    try {
        const response = await fetch(`/public/i18n/${language}.json`)
        if (response.ok) {
            catalogs[language] = await response.json()
        }
    } catch (error) {
        //Keep an empty catalog; the translator falls back to English, then to the key
    }
    return catalogs[language]
}

function applyDocumentLanguage() {
    if (typeof document !== 'undefined') {
        document.documentElement.lang = locale.value
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('locale', locale.value)
    }
}

export async function initI18n() {
    let saved = 'en'
    try {
        saved = localStorage.getItem('locale') || 'en'
    } catch (error) {
        saved = 'en'
    }
    locale.value = saved === 'vi' ? 'vi' : 'en'
    await Promise.all([loadCatalog('en'), loadCatalog(locale.value)])
    applyDocumentLanguage()
}

export async function setLocale(language) {
    //Load first: the catalog object is not reactive, so switching before it arrives renders English once
    const next = language === 'vi' ? 'vi' : 'en'
    await loadCatalog(next)
    locale.value = next
    applyDocumentLanguage()
}

export function t(key, params) {
    return translate(key, params)
}

export function useI18n() {
    return { locale, setLocale, t }
}
