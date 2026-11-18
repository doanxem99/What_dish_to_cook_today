import { describe, expect, it } from 'vitest'
import { guardDecision, isAdminUser } from './admin_guard.js'

const adminRoute = { path: '/admin', meta: { requiresAdmin: true } }
const publicRoute = { path: '/dishes', meta: {} }

const anonymous = { isLogin: false, isAdmin: false, mustChange: false }
const cook = { isLogin: true, isAdmin: false, mustChange: false }
const boss = { isLogin: true, isAdmin: true, mustChange: false }
const tempAdmin = { isLogin: true, isAdmin: true, mustChange: true }

describe('isAdminUser', () => {
  it('reads the admin role from the stored account', () => {
    expect(isAdminUser({ roles: ['user', 'admin'] })).toBe(true)
    expect(isAdminUser({ roles: ['user'] })).toBe(false)
    expect(isAdminUser({})).toBe(false)
    expect(isAdminUser(null)).toBe(false)
  })
})

describe('guardDecision', () => {
  it('sends anonymous visitors to sign-in and remembers the path', () => {
    expect(guardDecision(anonymous, adminRoute)).toEqual({ redirect: '/signin', remember: true })
  })

  it('blocks a signed-in non-admin from an admin route with the 403 panel', () => {
    expect(guardDecision(cook, adminRoute)).toBe('forbidden')
  })

  it('allows an admin', () => {
    expect(guardDecision(boss, adminRoute)).toBe('allow')
  })

  it('forces the password screen before anything else', () => {
    expect(guardDecision(tempAdmin, adminRoute)).toEqual({ redirect: '/change-password' })
    expect(guardDecision({ isLogin: true, isAdmin: false, mustChange: true }, publicRoute))
      .toEqual({ redirect: '/change-password' })
  })

  it('keeps the password screen open only while the flag is set', () => {
    expect(guardDecision(tempAdmin, { path: '/change-password' })).toBe('allow')
    expect(guardDecision(boss, { path: '/change-password' })).toEqual({ redirect: '/' })
  })

  it('does not guard public routes beyond the admin area', () => {
    expect(guardDecision(cook, publicRoute)).toBe('allow')
    expect(guardDecision(anonymous, publicRoute)).toBe('allow')
    expect(guardDecision(anonymous, { path: '/profile', meta: { requiresAuth: true } }))
      .toEqual({ redirect: '/signin', remember: true })
  })
})
