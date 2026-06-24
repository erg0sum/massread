import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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
  logOut: vi.fn(() => Promise.resolve()),
  isRegisteredAdmin: vi.fn(() => Promise.resolve(true)),
  getUserProfile: vi.fn(() => Promise.resolve(null)),
  saveUserProfile: vi.fn(() => Promise.resolve()),
}))

// Fire an auth state change once the onUser listener has attached.
async function fireAuth(fbUser) {
  await waitFor(() => expect(authCallback).toBeTypeOf('function'))
  await act(async () => { authCallback(fbUser) })
}

const GOOGLE_ADMIN = {
  uid: 'admin-uid',
  displayName: 'Prof Google',
  providerData: [{ providerId: 'google.com' }],
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

import { isRegisteredAdmin, setHomework, setActiveBook } from '../firebase'

function renderAdminApp() {
  return render(
    <MemoryRouter>
      <AdminApp />
    </MemoryRouter>
  )
}

// Imported lazily so the firebase mock is in place
let AdminApp
beforeAll(async () => {
  AdminApp = (await import('../AdminApp')).default
})

// Sign in as a registered Google admin and reach the nickname screen
async function reachNicknameAsAdmin() {
  await fireAuth(GOOGLE_ADMIN)
  return screen.findByLabelText(/nickname/i)
}

// Full path to the admin reader
async function enterReaderAsAdmin(user) {
  const nick = await reachNicknameAsAdmin()
  await user.clear(nick)
  await user.type(nick, 'Prof')
  await user.click(screen.getByRole('button', { name: /start reading/i }))
  await waitFor(() => screen.getByText(/set homework/i))
}

describe('AdminApp (registry-based admin)', () => {
  beforeEach(() => {
    authCallback = null
    homeworkCallback = null
    vi.clearAllMocks()
    isRegisteredAdmin.mockResolvedValue(true)
  })

  it('shows the Google sign-in gate first', async () => {
    renderAdminApp()
    expect(await screen.findByText(/admin access/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('denies a signed-in user who is not a registered admin', async () => {
    isRegisteredAdmin.mockResolvedValue(false)
    renderAdminApp()

    await fireAuth(GOOGLE_ADMIN)

    expect(await screen.findByText(/isn't registered as an admin/i)).toBeInTheDocument()
    // The UID is shown so they can be registered
    expect(screen.getByText(/admin-uid/)).toBeInTheDocument()
    // No nickname screen for non-admins
    expect(screen.queryByLabelText(/nickname/i)).not.toBeInTheDocument()
  })

  it('lets a registered admin reach the nickname screen with a suggested nickname', async () => {
    renderAdminApp()
    const nick = await reachNicknameAsAdmin()
    // A nickname is suggested (random here, since getUserProfile returns null)
    await waitFor(() => expect(nick.value).not.toBe(''))
  })

  it('shows the admin homework panel after setup', async () => {
    const user = userEvent.setup()
    renderAdminApp()
    await enterReaderAsAdmin(user)
    expect(screen.getByText(/set homework/i)).toBeInTheDocument()
  })

  it('assigns the checked sections when Assign is clicked', async () => {
    const user = userEvent.setup()
    renderAdminApp()
    await enterReaderAsAdmin(user)

    // Assign is disabled until at least one section is checked
    expect(screen.getByRole('button', { name: /assign/i })).toBeDisabled()

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
    renderAdminApp()
    await enterReaderAsAdmin(user)

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()

    await act(async () => {
      homeworkCallback?.({ sections: [{ href: 'ch1.xhtml', label: 'Chapter I' }] })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })
  })

  it('lets the admin pick the active book', async () => {
    const user = userEvent.setup()
    renderAdminApp()
    await enterReaderAsAdmin(user)

    const picker = await screen.findByDisplayValue('The Great Gatsby')
    expect(screen.getByText('Active Book')).toBeInTheDocument()

    await user.selectOptions(picker, 'pride')

    expect(setActiveBook).toHaveBeenCalledWith('pride')
  })

  it('surfaces a permission error when an admin write is denied', async () => {
    const user = userEvent.setup()
    setActiveBook.mockRejectedValueOnce({ code: 'permission-denied' })
    renderAdminApp()
    await enterReaderAsAdmin(user)

    const picker = await screen.findByDisplayValue('The Great Gatsby')
    await user.selectOptions(picker, 'pride')

    await waitFor(() => {
      expect(screen.getByText(/registered as an admin/i)).toBeInTheDocument()
    })
  })
})
