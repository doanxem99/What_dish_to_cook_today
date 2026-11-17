const STORAGE_KEY = 'theme'

export function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
        localStorage.setItem(STORAGE_KEY, next)
    } catch (error) {
        //Storage can be blocked; the session still follows the chosen theme
    }
    return next
}

export function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function toggleTheme() {
    return applyTheme(currentTheme() === 'light' ? 'dark' : 'light')
}

//Saved choice wins; otherwise follow the system preference once.
export function initTheme() {
    let saved = null
    try {
        saved = localStorage.getItem(STORAGE_KEY)
    } catch (error) {
        saved = null
    }
    if (saved === 'light' || saved === 'dark') {
        return applyTheme(saved)
    }
    const prefersLight = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    return applyTheme(prefersLight ? 'light' : 'dark')
}
