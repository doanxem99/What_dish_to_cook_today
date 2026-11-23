import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { citationHref, dishIdFromRoute, modeChip, parseSseBuffer, parseSseChunk, validateMessageInput } from './ask_format.js'

const catalogueDir = path.resolve(process.cwd(), '../server/public/i18n')
const read = lang => JSON.parse(fs.readFileSync(path.join(catalogueDir, `${lang}.json`), 'utf8'))

describe('ask assistant format and i18n parity', () => {
  it('has every ask.*, dish.cooked*, profile.ai*, and admin.ai.* key in both EN and VI', () => {
    const en = read('en')
    const vi = read('vi')
    const required = [
      'nav.ask',
      'ask.title',
      'ask.privacyNotice',
      'ask.mode.cook',
      'ask.mode.walkthrough',
      'ask.mode.help',
      'ask.mode.change',
      'ask.mode.overridden',
      'ask.capability.read_only',
      'ask.capability.prepare',
      'ask.capability.act_freely',
      'ask.placeholder',
      'ask.send',
      'ask.stop',
      'ask.stopped',
      'ask.signInPrompt',
      'ask.quotaReached',
      'ask.disabled',
      'ask.providerDown',
      'ask.embedFallback',
      'ask.applyIngredients',
      'ask.openDraft',
      'dish.cookAction',
      'dish.cookedToday',
      'profile.aiTitle',
      'profile.aiUsage',
      'profile.historyTitle',
      'profile.historyEmpty',
      'profile.clearHistory',
      'profile.deleteConversation',
      'admin.ai.rebuildIndex',
      'admin.ai.dailyLimit',
      'admin.ai.userDisabled'
    ]
    for (const key of required) {
      expect(en[key], `missing EN ${key}`).toBeTruthy()
      expect(vi[key], `missing VI ${key}`).toBeTruthy()
      expect(vi[key]).not.toBe(en[key])
    }
  })

  it('parses SSE frames and keeps incomplete trailing chunks in remainder', () => {
    const raw = 'event: token\ndata: {"text":"Phở "}\n\nevent: done\ndata: {"ok":true}\n\nevent: token\ndata: {"tex'
    const { events, remainder } = parseSseBuffer(raw)
    expect(events).toEqual([
      { event: 'token', data: { text: 'Phở ' } },
      { event: 'done', data: { ok: true } }
    ])
    expect(remainder).toBe('event: token\ndata: {"tex')
    expect(parseSseChunk).toBe(parseSseBuffer)
  })

  it('parses CRLF frames and ignores a malformed payload without losing the next event', () => {
    const raw = 'event: tool\r\ndata: {"name":"search_dishes"}\r\n\r\nevent: token\r\ndata: not-json\r\n\r\n'
    const { events, remainder } = parseSseBuffer(raw)
    expect(events).toEqual([
      { event: 'tool', data: { name: 'search_dishes' } },
      { event: 'token', data: 'not-json' }
    ])
    expect(remainder).toBe('')
  })

  it('builds citation links only from validated tool ids and bounds message input to 1..2000 chars', () => {
    expect(citationHref({ target_type: 'dish', id: '64b000000000000000000001' })).toBe('/dish_detail?dish_id=64b000000000000000000001')
    expect(citationHref({ target_type: 'ingredient', id: '64b000000000000000000002' })).toBe('/ingredient_detail?ingredient_id=64b000000000000000000002')
    expect(citationHref({ target_type: 'dish', id: 'javascript:alert(1)' })).toBe('')
    expect(citationHref({ target_type: 'doc', id: '64b000000000000000000001' })).toBe('')
    expect(validateMessageInput('   ')).toBe(false)
    expect(validateMessageInput('What can I cook?')).toBe(true)
    expect(validateMessageInput('x'.repeat(2000))).toBe(true)
    expect(validateMessageInput('x'.repeat(2001))).toBe(false)
  })

  it('shows a goal chip only for an inferred mode it knows, and marks a user override', () => {
    expect(modeChip('cook', 'rules')).toEqual({ labelKey: 'ask.mode.cook', noticeKey: '' })
    expect(modeChip('walkthrough', 'embedding')).toEqual({ labelKey: 'ask.mode.walkthrough', noticeKey: '' })
    expect(modeChip('help', 'default')).toEqual({ labelKey: 'ask.mode.help', noticeKey: '' })
    expect(modeChip('cook', 'user')).toEqual({ labelKey: 'ask.mode.cook', noticeKey: 'ask.mode.overridden' })
    expect(modeChip('', '')).toBeNull()
    expect(modeChip(undefined, undefined)).toBeNull()
    expect(modeChip('translate', 'rules')).toBeNull()
  })

  it('takes the open dish id only from a dish detail page', () => {
    const id = '64b000000000000000000001'
    expect(dishIdFromRoute({ path: '/dish_detail', query: { dish_id: id } })).toBe(id)
    expect(dishIdFromRoute({ path: '/dish_detail', query: { dish_post_id: id } })).toBe('')
    expect(dishIdFromRoute({ path: '/dish_detail', query: { dish_id: 'javascript:alert(1)' } })).toBe('')
    expect(dishIdFromRoute({ path: '/dishes', query: { dish_id: id } })).toBe('')
    expect(dishIdFromRoute(null)).toBe('')
  })
})
