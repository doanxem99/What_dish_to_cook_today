import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { translationFailure } from './translation_error.js'

describe('translationFailure', () => {
    it('reports an unconfigured service for 503', () => {
        expect(translationFailure(503)).toBe('notConfigured')
    })

    it('reports an unreachable service for 502', () => {
        expect(translationFailure(502)).toBe('unreachable')
    })

    it('reports a plain failure for anything else', () => {
        expect(translationFailure(400)).toBe('failed')
        expect(translationFailure(500)).toBe('failed')
        expect(translationFailure(undefined)).toBe('failed')
        expect(translationFailure(null)).toBe('failed')
        expect(translationFailure(0)).toBe('failed')
    })
})

const catalogueDir = path.resolve(process.cwd(), '../server/public/i18n')
const read = language => JSON.parse(fs.readFileSync(path.join(catalogueDir, `${language}.json`), 'utf8'))
const keys = ['edit.translate.notConfigured', 'edit.translate.unreachable', 'edit.translate.failed']

describe('translation failure catalogue parity', () => {
    const en = read('en')
    const vi = read('vi')

    it('has every failure key in both catalogues', () => {
        expect(keys.filter(key => !String(en[key] || '').trim())).toEqual([])
        expect(keys.filter(key => !String(vi[key] || '').trim())).toEqual([])
    })

    it('drafts the Vietnamese wording instead of copying English', () => {
        expect(keys.filter(key => vi[key] === en[key])).toEqual([])
    })

    it('says the text was kept in every message', () => {
        expect(keys.filter(key => !/kept|giữ/i.test(en[key]))).toEqual([])
        expect(keys.filter(key => !/giữ/i.test(vi[key]))).toEqual([])
    })
})
