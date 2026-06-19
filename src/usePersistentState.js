import { useState, useEffect } from 'react'

// True on narrow (mobile) viewports. Guarded so it's safe under jsdom/tests
// where matchMedia may be unavailable.
export function isMobileViewport() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 600px)').matches
  )
}

// useState backed by localStorage. `computeDefault` (value or fn) is used only
// when nothing is stored yet, so an explicit user choice always wins.
export function usePersistentState(key, computeDefault) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored)
    } catch {
      /* ignore storage/parse errors */
    }
    return typeof computeDefault === 'function' ? computeDefault() : computeDefault
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore storage errors (e.g. private mode) */
    }
  }, [key, value])

  return [value, setValue]
}
