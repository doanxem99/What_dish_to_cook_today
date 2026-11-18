import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { shouldApplyTranslation, translationFailure, translationFailureFor, translationFailureKey } from './translation_error.js'

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

describe('translationFailureKey', () => {
    it('maps a status to the catalogue key the editors show', () => {
        expect(translationFailureKey(503)).toBe('edit.translate.notConfigured')
        expect(translationFailureKey(502)).toBe('edit.translate.unreachable')
        expect(translationFailureKey(500)).toBe('edit.translate.failed')
        expect(translationFailureKey(undefined)).toBe('edit.translate.failed')
    })
})

describe('translationFailureFor', () => {
    it('maps a failure to its block while the block still exists', () => {
        expect(translationFailureFor('block-2', ['block-1', 'block-2'], 503)).toBe('edit.translate.notConfigured')
    })

    it('drops the failure of a block that was removed during the request', () => {
        expect(translationFailureFor('block-2', ['block-1'], 502)).toBe(null)
        expect(translationFailureFor(undefined, [], 500)).toBe(null)
    })
})

describe('shouldApplyTranslation', () => {
    const requestSource = 'Pho bo'

    it('applies when the source is unchanged and the target is still empty', () => {
        expect(shouldApplyTranslation({ currentSource: requestSource, requestSource, currentTarget: '' })).toBe(true)
        expect(shouldApplyTranslation({ currentSource: requestSource, requestSource, currentTarget: '   ' })).toBe(true)
        expect(shouldApplyTranslation({ currentSource: requestSource, requestSource, currentTarget: null })).toBe(true)
    })

    it('drops a result for an older source', () => {
        expect(shouldApplyTranslation({ currentSource: 'Pho bo (new)', requestSource, currentTarget: '' })).toBe(false)
    })

    it('drops a result when the user typed the target during the request', () => {
        expect(shouldApplyTranslation({ currentSource: requestSource, requestSource, currentTarget: 'Phở bò' })).toBe(false)
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

    it('sends an unconfigured service to an admin instead of asking for another edit', () => {
        expect(en['edit.translate.notConfigured']).toMatch(/admin/i)
        expect(en['edit.translate.notConfigured']).not.toMatch(/edit the field/i)
        expect(vi['edit.translate.notConfigured']).toMatch(/quản trị/i)
    })
})

describe('translation catalogue parity', () => {
    const en = read('en')
    const vi = read('vi')

    it('has the same keys in both catalogues', () => {
        expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort())
    })

    it('names both translation directions in both catalogues', () => {
        for (const key of ['edit.translate.enToVi', 'edit.translate.viToEn']) {
            expect(String(en[key] || '').trim()).not.toBe('')
            expect(String(vi[key] || '').trim()).not.toBe('')
            expect(vi[key]).not.toBe(en[key])
        }
    })
})
