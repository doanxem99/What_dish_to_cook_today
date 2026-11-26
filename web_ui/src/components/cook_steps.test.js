import { describe, it, expect } from 'vitest'
import { stepTexts, stepsFor, formatClock } from './cook_steps'

describe('cook steps', () => {
    const blocks = [
        { type: 'text', text: 'Boil the broth.', text_vi: 'Đun nước dùng.' },
        { type: 'image', src: 'x.jpg', text: '', text_vi: '' },
        { type: 'text', text: '   ', text_vi: '' },
        { type: 'text', text: 'Serve hot.', text_vi: '' }
    ]

    it('keeps only non-empty text blocks', () => {
        expect(stepTexts(blocks, 'en')).toEqual(['Boil the broth.', 'Serve hot.'])
    })

    it('falls back to English when a Vietnamese block is empty', () => {
        expect(stepTexts(blocks, 'vi')).toEqual(['Đun nước dùng.', 'Serve hot.'])
    })

    it('uses the description when the post has no written steps', () => {
        const post = { display_blocks: [], short_detail: 'Quick rice', short_detail_vi: 'Cơm nhanh' }
        expect(stepsFor(post, 'en')).toEqual(['Quick rice'])
        expect(stepsFor(post, 'vi')).toEqual(['Cơm nhanh'])
    })

    it('returns nothing when there is neither steps nor a description', () => {
        expect(stepsFor({ display_blocks: [] }, 'en')).toEqual([])
        expect(stepsFor(null, 'en')).toEqual([])
    })

    it('formats a clock value', () => {
        expect(formatClock(600)).toBe('10:00')
        expect(formatClock(65)).toBe('1:05')
        expect(formatClock(-5)).toBe('0:00')
    })
})
