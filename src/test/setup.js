import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// ── localStorage polyfill ─────────────────────────────────────────
// This jsdom setup doesn't provide localStorage; back it with an in-memory map.
if (typeof globalThis.localStorage === 'undefined') {
  let store = {}
  const localStorageMock = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
}

// ── matchMedia polyfill ───────────────────────────────────────────
// Defaults to "not matching" (desktop). Override per-test by reassigning
// window.matchMedia or spying on it.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// Keep persisted state from leaking between tests
beforeEach(() => {
  globalThis.localStorage?.clear()
})
