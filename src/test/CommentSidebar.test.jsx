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
const USER = { uid: 'u1', name: 'Alice', color: 'yellow' }

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

  it('subscribes to comments when a card is expanded', async () => {
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
    expect(subscribeComments).toHaveBeenCalledWith(BOOK_ID, 'h1', expect.any(Function))
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
})
