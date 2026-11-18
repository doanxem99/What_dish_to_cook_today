import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const catalogueDir = path.resolve(process.cwd(), '../server/public/i18n')
const read = language => JSON.parse(fs.readFileSync(path.join(catalogueDir, `${language}.json`), 'utf8'))

const en = read('en')
const vi = read('vi')
const adminKeys = Object.keys(en).filter(key => key.startsWith('admin.'))

describe('admin catalogue parity', () => {
  it('has admin keys', () => {
    expect(adminKeys.length).toBeGreaterThan(50)
  })

  it('carries every admin key in Vietnamese too', () => {
    const missing = adminKeys.filter(key => !(key in vi))
    expect(missing).toEqual([])
  })

  it('has no empty or English-copied admin value in Vietnamese', () => {
    const empty = adminKeys.filter(key => !String(vi[key]).trim())
    //Only the product's own acronym may stay identical in both languages.
    const copied = adminKeys.filter(key => vi[key] === en[key] && !['admin.nav.ai', 'admin.probe.latency'].includes(key))
    expect(empty).toEqual([])
    expect(copied).toEqual([])
  })
})
