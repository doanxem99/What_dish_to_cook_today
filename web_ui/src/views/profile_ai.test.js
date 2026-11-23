import { describe, expect, it } from 'vitest'
import { eventTargetHref, eventTypeKey, formatQuotaUsage } from '../components/ask_format.js'

describe('profile AI and history helpers', () => {
  it('maps user_event types to i18n keys and target links', () => {
    expect(eventTypeKey('dish_viewed')).toBe('profile.event.dish_viewed')
    expect(eventTypeKey('dish_cooked')).toBe('profile.event.dish_cooked')
    expect(eventTypeKey('ingredient_picked')).toBe('profile.event.ingredient_picked')
    expect(eventTypeKey('chat_message')).toBe('profile.event.chat_message')
    expect(eventTypeKey('something_else')).toBe('profile.event.other')

    expect(eventTargetHref({ type: 'dish_cooked', target_id: '64b000000000000000000001' }))
      .toBe('/dish_detail?dish_id=64b000000000000000000001')
    expect(eventTargetHref({ type: 'ingredient_picked', target_id: '64b000000000000000000002' }))
      .toBe('/ingredient_detail?ingredient_id=64b000000000000000000002')
    expect(eventTargetHref({ type: 'chat_message', target_id: '' })).toBe('')
    expect(eventTargetHref({ type: 'dish_viewed', target_id: 'javascript:alert(1)' })).toBe('')
  })

  it('formats daily quota usage', () => {
    const t = (key, params) => `${key}:${params.used}/${params.limit}`
    expect(formatQuotaUsage({ used: 4, limit: 20 }, t)).toBe('profile.aiUsage:4/20')
  })
})
