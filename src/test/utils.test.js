import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── hexToRgba ────────────────────────────────────────────────────
// Extracted inline so we can test without importing the full component
function hexToRgba(hex, alpha = 0.35) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

describe('hexToRgba', () => {
  it('converts a hex color to rgba with default alpha', () => {
    expect(hexToRgba('#FACC15')).toBe('rgba(250,204,21,0.35)')
  })

  it('converts pure red', () => {
    expect(hexToRgba('#ff0000')).toBe('rgba(255,0,0,0.35)')
  })

  it('accepts a custom alpha', () => {
    expect(hexToRgba('#000000', 1)).toBe('rgba(0,0,0,1)')
  })
})

// ── timeAgo ──────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for falsy input', () => {
    expect(timeAgo(null)).toBe('')
    expect(timeAgo(undefined)).toBe('')
  })

  it('returns "just now" for timestamps under a minute ago', () => {
    const ts = new Date('2024-01-01T11:59:30Z')
    expect(timeAgo(ts)).toBe('just now')
  })

  it('returns minutes for timestamps under an hour ago', () => {
    const ts = new Date('2024-01-01T11:30:00Z')
    expect(timeAgo(ts)).toBe('30m ago')
  })

  it('returns hours for timestamps under a day ago', () => {
    const ts = new Date('2024-01-01T09:00:00Z')
    expect(timeAgo(ts)).toBe('3h ago')
  })

  it('returns days for older timestamps', () => {
    const ts = new Date('2023-12-29T12:00:00Z')
    expect(timeAgo(ts)).toBe('3d ago')
  })

  it('accepts a Firestore-style timestamp with toDate()', () => {
    const ts = { toDate: () => new Date('2024-01-01T11:59:30Z') }
    expect(timeAgo(ts)).toBe('just now')
  })
})
