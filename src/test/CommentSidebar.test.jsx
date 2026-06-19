import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock firebase so no real Firestore calls are made
vi.mock('../firebase', () => ({
  subscribeComments: vi.fn(() => () => {}),
  addComment: vi.fn(() => Promise.resolve()),
  deleteComment: vi.fn(() => Promise.resolve()),
}))

import CommentSidebar from '../components/CommentSidebar'
import { subscribeComments } from '../firebase'

const BOOK_ID = 'test-book'
const USER = { uid: 'u1', name: 'Alice', color: 'yellow', signedIn: true }
const ANON_USER = { uid: 'anon1', name: 'Guest', color: 'blue', signedIn: false }

const makeHighlight = (overrides = {}) => ({
  id: 'h1',
  cfiRange: 'epubcfi(/6/2!/4/2)',
  quote: 'In my younger and more vulnerable years',
  color: 'yellow',
  authorName: 'Alice',
  authorUid: 'u1',
  commentCount: 0,
  createdAt: { toDate: () => new Date(Date.now() - 60000) },
  ...overrides,
})

describe('CommentSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when there are no highlights', () => {
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    expect(screen.getByText(/select any text/i)).toBeInTheDocument()
  })

  it('can be collapsed and reopened', async () => {
    const user = userEvent.setup()
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    // Expanded: highlight content visible
    expect(screen.getByText(/younger and more vulnerable/i)).toBeInTheDocument()

    // Collapse — content hides, reopen control appears
    await user.click(screen.getByRole('button', { name: /hide highlights/i }))
    expect(screen.queryByText(/younger and more vulnerable/i)).not.toBeInTheDocument()

    // Reopen — content returns
    await user.click(screen.getByRole('button', { name: /show highlights/i }))
    expect(screen.getByText(/younger and more vulnerable/i)).toBeInTheDocument()
  })

  it('remembers the collapsed state across remounts', async () => {
    const user = userEvent.setup()
    const props = {
      bookId: BOOK_ID,
      highlights: [makeHighlight()],
      activeHighlightId: null,
      user: USER,
      onHighlightClick: () => {},
      onHighlightDelete: () => {},
    }
    const { unmount } = render(<CommentSidebar {...props} />)
    await user.click(screen.getByRole('button', { name: /hide highlights/i }))
    unmount()

    // Fresh mount reads the persisted preference → still collapsed
    render(<CommentSidebar {...props} />)
    expect(screen.getByRole('button', { name: /show highlights/i })).toBeInTheDocument()
    expect(screen.queryByText(/younger and more vulnerable/i)).not.toBeInTheDocument()
  })

  it('defaults to collapsed on a mobile viewport', () => {
    const original = window.matchMedia
    window.matchMedia = (q) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })
    try {
      render(
        <CommentSidebar
          bookId={BOOK_ID}
          highlights={[makeHighlight()]}
          activeHighlightId={null}
          user={USER}
          onHighlightClick={() => {}}
          onHighlightDelete={() => {}}
        />
      )
      // Collapsed by default: reopen control present, content hidden
      expect(screen.getByRole('button', { name: /show highlights/i })).toBeInTheDocument()
      expect(screen.queryByText(/younger and more vulnerable/i)).not.toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('renders a highlight card with the quote', () => {
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    expect(screen.getByText(/younger and more vulnerable/i)).toBeInTheDocument()
  })

  it('shows highlight count in the header', () => {
    const highlights = [makeHighlight(), makeHighlight({ id: 'h2', quote: 'Another quote' })]
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={highlights}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows delete button only for own highlights', () => {
    const highlights = [
      makeHighlight({ id: 'h1', authorUid: 'u1' }),
      makeHighlight({ id: 'h2', authorUid: 'other', quote: 'Their quote here' }),
    ]
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={highlights}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    // Only one delete button for the user's own highlight
    expect(screen.getAllByTitle(/delete highlight/i)).toHaveLength(1)
  })

  it('calls onHighlightDelete when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={onDelete}
      />
    )
    await user.click(screen.getByTitle(/delete highlight/i))
    expect(onDelete).toHaveBeenCalledWith('h1')
  })

  it('calls onHighlightClick when a card is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={onClick}
        onHighlightDelete={() => {}}
      />
    )
    await user.click(screen.getByText(/younger and more vulnerable/i))
    expect(onClick).toHaveBeenCalledWith('h1')
  })

  it('subscribes to comments on mount (for the live count)', () => {
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    expect(subscribeComments).toHaveBeenCalledWith(BOOK_ID, 'h1', expect.any(Function))
  })

  it('shows the live comment count from the subscription, not the stale field', () => {
    // makeHighlight() has commentCount: 0, but there are really 2 comments
    subscribeComments.mockImplementationOnce((_b, _h, cb) => {
      cb([{ id: 'c1' }, { id: 'c2' }])
      return () => {}
    })
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight({ commentCount: 0 })]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    expect(screen.getByText(/2 comments/i)).toBeInTheDocument()
  })

  it('marks the active highlight card', () => {
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId="h1"
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    // The active card gets the .active class
    const card = screen.getByText(/younger and more vulnerable/i).closest('.highlight-card')
    expect(card).toHaveClass('active')
  })

  it('shows the comment input for a signed-in user', async () => {
    const user = userEvent.setup()
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    await user.click(screen.getByRole('button', { name: /comment/i }))
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
    expect(screen.queryByText(/sign in with google to join/i)).not.toBeInTheDocument()
  })

  it('hides the comment input and prompts anonymous users to sign in', async () => {
    const user = userEvent.setup()
    render(
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={[makeHighlight()]}
        activeHighlightId={null}
        user={ANON_USER}
        onHighlightClick={() => {}}
        onHighlightDelete={() => {}}
      />
    )
    await user.click(screen.getByRole('button', { name: /comment/i }))
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument()
    expect(screen.getByText(/sign in with google to join/i)).toBeInTheDocument()
  })
})
