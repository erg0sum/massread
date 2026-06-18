import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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
  subscribeActiveBook: vi.fn(() => () => {}),
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
    loaded: { navigation: Promise.resolve({ toc: [
      { href: 'ch1.xhtml', label: 'Chapter I', id: 'ch1' },
      { href: 'ch2.xhtml', label: 'Chapter II', id: 'ch2' },
    ] }) },
    destroy: vi.fn(),
    navigation: null,
  }),
}))

// ── books catalog mock (two books so the picker is meaningful) ────
const { TWO_BOOKS } = vi.hoisted(() => ({
  TWO_BOOKS: [
    { id: 'great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', url: '/gatsby.epub' },
    { id: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', url: '/pride.epub' },
  ],
}))
vi.mock('../books', () => ({
  BOOKS: TWO_BOOKS,
  DEFAULT_BOOK_ID: 'great-gatsby',
  getBook: (id) => TWO_BOOKS.find((b) => b.id === id) || TWO_BOOKS[0],
}))

import { setHomework, setActiveBook } from '../firebase'

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

  it('goes straight to the reader when a Google user signs in after entering the admin code', async () => {
    sessionStorage.setItem('admin-authed', '1')
    await renderAdminApp()

    await fireAuth({
      uid: 'admin-uid',
      displayName: 'Prof Google',
      providerData: [{ providerId: 'google.com' }],
    })

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
    await fireAuth({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => {
      expect(screen.getByText(/set homework/i)).toBeInTheDocument()
    })
  })

  it('assigns the checked sections when Assign is clicked', async () => {
    const user = userEvent.setup()
    await renderAdminApp()

    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await fireAuth({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByText(/set homework/i))

    // Assign is disabled until at least one section is checked
    expect(screen.getByRole('button', { name: /assign/i })).toBeDisabled()

    // Pick two arbitrary (non-adjacent in intent) sections
    await user.click(screen.getByRole('checkbox', { name: 'Chapter I' }))
    await user.click(screen.getByRole('checkbox', { name: 'Chapter II' }))
    await user.click(screen.getByRole('button', { name: /assign/i }))

    expect(setHomework).toHaveBeenCalledWith(
      expect.any(String),
      {
        sections: [
          { href: 'ch1.xhtml', label: 'Chapter I' },
          { href: 'ch2.xhtml', label: 'Chapter II' },
        ],
      }
    )
  })

  it('shows the Clear button when homework exists', async () => {
    const user = userEvent.setup()
    await renderAdminApp()

    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await fireAuth({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    await waitFor(() => screen.getByText(/set homework/i))

    // No homework yet — Clear should not be visible
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()

    // Simulate homework being set
    homeworkCallback?.({ sections: [{ href: 'ch1.xhtml', label: 'Chapter I' }] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })
  })

  it('lets the admin pick the active book', async () => {
    const user = userEvent.setup()
    await renderAdminApp()

    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await fireAuth({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    // The Active Book panel and both catalog titles are present
    const picker = await screen.findByDisplayValue('The Great Gatsby')
    expect(screen.getByText('Active Book')).toBeInTheDocument()

    await user.selectOptions(picker, 'pride')

    expect(setActiveBook).toHaveBeenCalledWith('pride')
  })

  it('surfaces a permission error when an admin write is denied', async () => {
    const user = userEvent.setup()
    setActiveBook.mockRejectedValueOnce({ code: 'permission-denied' })
    await renderAdminApp()

    await user.type(screen.getByLabelText(/admin code/i), ADMIN_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await fireAuth({ uid: 'admin-uid' })
    await user.type(await screen.findByLabelText(/nickname/i), 'Prof')
    await user.click(screen.getByRole('button', { name: /start reading/i }))

    const picker = await screen.findByDisplayValue('The Great Gatsby')
    await user.selectOptions(picker, 'pride')

    await waitFor(() => {
      expect(screen.getByText(/registered as an admin/i)).toBeInTheDocument()
    })
  })
})
