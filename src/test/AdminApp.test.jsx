import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const ADMIN_CODE = 'adminpass'

// ── Firebase mock ─────────────────────────────────────────────────
let authCallback = null
let homeworkCallback = null

vi.mock('../firebase', () => ({
  signInAnon: vi.fn(() => Promise.resolve()),
  onUser: vi.fn((cb) => { authCallback = cb; return () => {} }),
  subscribeHighlights: vi.fn((_, cb) => { cb([]); return () => {} }),
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
    loaded: { navigation: Promise.resolve({ toc: [
      { href: 'ch1.xhtml', label: 'Chapter I', id: 'ch1' },
      { href: 'ch2.xhtml', label: 'Chapter II', id: 'ch2' },
    ] }) },
    destroy: vi.fn(),
    navigation: null,
  }),
}))

import { setHomework } from '../firebase'

async function renderAdminApp() {
  vi.stubEnv('VITE_ADMIN_CODE', ADMIN_CODE)
  vi.resetModules()
  const { default: AdminApp } = await import('../AdminApp')
  return render(
    <MemoryRouter>
      <AdminApp />
    </MemoryRouter>
  )
}

describe('AdminApp (admin flow)', () => {
  beforeEach(() => {
    authCallback = null
    homeworkCallback = null
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('shows the AdminLogin screen first', async () => {
    await renderAdminApp()
    expect(screen.getByText(/admin access/i)).toBeInTheDocument()
  })

  it('blocks access with a wrong code', async () => {
    const user = userEvent.setup()
    await renderAdminApp()
    await user.type(screen.getByLabelText(/admin code/i), 'wrongcode')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/incorrect code/i)).toBeInTheDocument()
    expect(screen.queryByText(/join the reading/i)).not.toBeInTheDocument()
  })

  it('proceeds to nickname setup after correct code', async () => {
    const user = userEvent.setup()
    await renderAdminApp()
    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/join the reading/i)).toBeInTheDocument()
  })

  it('goes straight to the reader after Google redirect when admin code was entered', async () => {
    // Simulate sessionStorage having the admin-authed flag (set before redirect)
    sessionStorage.setItem('admin-authed', '1')
    const { getGoogleRedirectResult } = await import('../firebase')
    getGoogleRedirectResult.mockResolvedValueOnce({ uid: 'admin-uid', displayName: 'Prof Google' })

    await renderAdminApp()

    await waitFor(() => {
      expect(screen.queryByText(/admin access/i)).not.toBeInTheDocument()
      expect(screen.getByText(/set homework/i)).toBeInTheDocument()
    })
  })

  it('shows the admin homework panel after full login', async () => {
    const user = userEvent.setup()
    await renderAdminApp()

    // Step 1: admin code
    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2: nickname
    authCallback?.({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => {
      expect(screen.getByText(/set homework/i)).toBeInTheDocument()
    })
  })

  it('calls setHomework with start and end labels when Assign is clicked', async () => {
    const user = userEvent.setup()
    await renderAdminApp()

    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    authCallback?.({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByText(/set homework/i))

    await user.click(screen.getByRole('button', { name: /assign/i }))

    expect(setHomework).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ startLabel: 'Chapter I', endLabel: expect.any(String) })
    )
  })

  it('shows the Clear button when homework exists', async () => {
    const user = userEvent.setup()
    await renderAdminApp()

    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    authCallback?.({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByText(/set homework/i))

    // No homework yet — Clear should not be visible
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()

    // Simulate homework being set
    homeworkCallback?.({ startLabel: 'Chapter I', endLabel: 'Chapter II', startHref: 'ch1.xhtml', endHref: 'ch2.xhtml' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })
  })
})
