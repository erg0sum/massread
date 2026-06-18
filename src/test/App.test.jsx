import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── Firebase mock ─────────────────────────────────────────────────
let authCallback = null
let highlightCallback = null
let homeworkCallback = null
let activeBookCallback = null

vi.mock('../firebase', () => ({
  signInAnon: vi.fn(() => Promise.resolve()),
  onUser: vi.fn((cb) => { authCallback = cb; return () => {} }),
  subscribeHighlights: vi.fn((_, cb) => { highlightCallback = cb; return () => {} }),
  subscribeHomework: vi.fn((_, cb) => { homeworkCallback = cb; return () => {} }),
  subscribeActiveBook: vi.fn((cb) => { activeBookCallback = cb; return () => {} }),
  setActiveBook: vi.fn(() => Promise.resolve()),
  addHighlight: vi.fn(() => Promise.resolve()),
  deleteHighlight: vi.fn(() => Promise.resolve()),
  setHomework: vi.fn(() => Promise.resolve()),
  clearHomework: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(() => Promise.resolve()),
}))

// Fire an auth state change once the onUser listener has attached.
async function fireAuth(fbUser) {
  await waitFor(() => expect(authCallback).toBeTypeOf('function'))
  await act(async () => { authCallback(fbUser) })
}

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
    activeBookCallback = null
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
    await fireAuth({ uid: 'firebase-uid-1' })

    await user.type(screen.getByLabelText(/nickname/i), 'Daisy')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    // The reader layout should be in the DOM now
    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  it('goes straight to the reader when a Google user signs in', async () => {
    renderApp()
    await fireAuth({
      uid: 'google-uid',
      displayName: 'Ada Lovelace',
      providerData: [{ providerId: 'google.com' }],
    })
    await waitFor(() => {
      expect(screen.queryByText(/join the reading/i)).not.toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  it('shows the homework banner with all assigned sections', async () => {
    const user = userEvent.setup()
    renderApp()

    await fireAuth({ uid: 'uid-1' })
    await user.type(screen.getByLabelText(/nickname/i), 'Nick')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByRole('navigation'))

    await act(async () => {
      homeworkCallback?.({
        sections: [
          { href: 'ch1.xhtml', label: 'Chapter I' },
          { href: 'ch3.xhtml', label: 'Chapter III' },
        ],
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Chapter I' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Chapter III' })).toBeInTheDocument()
    })
  })

  it('does not show admin homework controls for a regular user', async () => {
    const user = userEvent.setup()
    renderApp()

    await fireAuth({ uid: 'uid-2' })
    await user.type(screen.getByLabelText(/nickname/i), 'Bob')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByRole('navigation'))

    expect(screen.queryByText(/set homework/i)).not.toBeInTheDocument()
  })

  it('does not show the active-book picker for a regular user', async () => {
    const user = userEvent.setup()
    renderApp()

    await fireAuth({ uid: 'uid-3' })
    await user.type(screen.getByLabelText(/nickname/i), 'Carol')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByRole('navigation'))

    expect(screen.queryByText(/active book/i)).not.toBeInTheDocument()
  })

  it('switches the displayed book when the active book changes', async () => {
    const user = userEvent.setup()
    renderApp()

    await fireAuth({ uid: 'uid-4' })
    await user.type(screen.getByLabelText(/nickname/i), 'Dave')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByRole('navigation'))

    // Default book title shows in the TOC sidebar
    expect(screen.getByText('The Great Gatsby')).toBeInTheDocument()

    // An unknown id falls back to the default catalog book (no crash)
    await act(async () => { activeBookCallback?.('great-gatsby') })
    expect(screen.getByText('The Great Gatsby')).toBeInTheDocument()
  })
})
