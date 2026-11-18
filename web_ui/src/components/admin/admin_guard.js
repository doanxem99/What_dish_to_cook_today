//A stored account written by an older build has no roles or flag: ask the server once on boot.
export function needsHydration(account) {
  return Boolean(account) && (!Array.isArray(account.roles) || typeof account.mustChange !== 'boolean')
}

//Pure route decision for the admin area. No router, no store: the test can call it directly.
export const ADMIN_ROLE = 'admin'
export const CHANGE_PASSWORD_PATH = '/change-password'

export function isAdminUser(user) {
  return Boolean(user && Array.isArray(user.roles) && user.roles.includes(ADMIN_ROLE))
}

//Returns 'allow', 'forbidden', or {redirect, remember}. Remember keeps the return path for sign-in.
export function guardDecision(session, to) {
  const path = (to && to.path) || '/'
  const requiresAdmin = Boolean(to && to.meta && to.meta.requiresAdmin)
  const requiresAuth = requiresAdmin || Boolean(to && to.meta && to.meta.requiresAuth)

  if (path === CHANGE_PASSWORD_PATH) {
    //The forced screen is reachable only while the flag is set; afterwards it is a dead end.
    return session.mustChange ? 'allow' : { redirect: '/' }
  }
  if (!session.isLogin) {
    return requiresAuth ? { redirect: '/signin', remember: true } : 'allow'
  }
  if (session.mustChange) {
    return { redirect: CHANGE_PASSWORD_PATH }
  }
  if (requiresAdmin && !session.isAdmin) {
    //The layout renders the 403 panel: the URL stays, no admin view mounts.
    return 'forbidden'
  }
  return 'allow'
}
