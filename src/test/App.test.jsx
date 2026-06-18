import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── Firebase mock ─────────────────────────────────────────────────
let authCallback = null
let highlightCallback = null
let homeworkCallback = null

vi.mock('../firebase', () => ({
  signInAnon: vi.fn(() => Promise.resolve()),
  onUser: vi.fn((cb) => { authCallback = cb; return () => {} }),
  subscribeHighlights: vi.fn((_, cb) => { highlightCallback = cb; return () => {} }),
  subscribeHomework: vi.fn((_, cb) => { homeworkCallback = cb; return () => {} }),
  addHighlight: vi.fn(() => Promise.resolve()),
  deleteHighlight: vi.fn(() => Promise.resolve()),
  setHomework: vi.fn(() => Promise.resolve()),
  clearHomework: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(() => Promise.resolve()),
  getGoogleRedirectResult: vi.fn(() => Promise.resolve(null)),
}))

// ── epubjs mock ───────────────────────────────────────────────────
vi.mock('epubjs', () => ({
  default: () => ({
    renderTo: () => ({
      themes: { register: vi.fn(), select: vi.fn() },
      display: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
      annotations: { highlight: vi.fn() },
      getContents: vi.fn(() => []),
    }),
    ready: Promise.resolve(),
    locations: { generate: vi.fn(() => Promise.resolve()) },
    loaded: { navigation: Promise.resolve({ toc: [] }) },
    destroy: vi.fn(),
    navigation: null,
  }),
}))

import App from '../App'

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  )
}

describe('App (student flow)', () => {
  beforeEach(() => {
    authCallback = null
    highlightCallback = null
    homeworkCallback = null
    vi.clearAllMocks()
  })

  it('shows the UserSetup screen before the user is authenticated', () => {
    renderApp()
    expect(screen.getByText(/join the reading/i)).toBeInTheDocument()
  })

  it('does not show the reader before setup is complete', () => {
    renderApp()
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })

  it('transitions to the reader after nickname is submitted', async () => {
    const user = userEvent.setup()
    renderApp()

    // Simulate Firebase returning a user
    authCallback?.({ uid: 'firebase-uid-1' })

    await user.type(screen.getByLabelText(/nickname/i), 'Daisy')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    // The reader layout should be in the DOM now
    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  it('goes straight to the reader when Google redirect result is present', async () => {
    const { getGoogleRedirectResult } = await import('../firebase')
    getGoogleRedirectResult.mockResolvedValueOnce({ uid: 'google-uid', displayName: 'Ada Lovelace' })

    renderApp()

    await waitFor(() => {
      expect(screen.queryByText(/join the reading/i)).not.toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  it('shows the homework banner when homework is set', async () => {
    const user = userEvent.setup()
    renderApp()

    authCallback?.({ uid: 'uid-1' })
    await user.type(screen.getByLabelText(/nickname/i), 'Nick')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByRole('navigation'))

    homeworkCallback?.({ startLabel: 'Chapter I', endLabel: 'Chapter III', startHref: 'ch1.xhtml', endHref: 'ch3.xhtml' })

    await waitFor(() => {
      expect(screen.getByText(/chapter i/i)).toBeInTheDocument()
      expect(screen.getByText(/chapter iii/i)).toBeInTheDocument()
    })
  })

  it('does not show admin homework controls for a regular user', async () => {
    const user = userEvent.setup()
    renderApp()

    authCallback?.({ uid: 'uid-2' })
    await user.type(screen.getByLabelText(/nickname/i), 'Bob')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByRole('navigation'))

    expect(screen.queryByText(/set homework/i)).not.toBeInTheDocument()
  })
})
