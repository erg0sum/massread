import { describe, it, expect } from 'vitest'
import { moderateText } from '../../functions/moderation'

describe('moderateText', () => {
  it('leaves clean text untouched', () => {
    const { clean, moderated } = moderateText('What a wonderful chapter!')
    expect(clean).toBe('What a wonderful chapter!')
    expect(moderated).toBe(false)
  })

  it('masks a banned word and flags it', () => {
    const { clean, moderated } = moderateText('this is crap')
    expect(clean).toBe('this is ****')
    expect(moderated).toBe(true)
  })

  it('is case-insensitive', () => {
    const { clean, moderated } = moderateText('Total BULLSHIT here')
    expect(clean).toBe('Total ******** here')
    expect(moderated).toBe(true)
  })

  it('masks multiple occurrences', () => {
    const { clean } = moderateText('damn, damn it')
    expect(clean).toBe('****, **** it')
  })

  it('only matches whole words, not substrings', () => {
    // "class" contains "ass" but should not be masked
    const { clean, moderated } = moderateText('We read a class assignment')
    expect(clean).toBe('We read a class assignment')
    expect(moderated).toBe(false)
  })

  it('handles non-string input gracefully', () => {
    expect(moderateText(undefined)).toEqual({ clean: undefined, moderated: false })
  })
})
