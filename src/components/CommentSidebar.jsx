import { useState, useEffect, useRef } from 'react'
import { subscribeComments, addComment, deleteComment } from '../firebase'
import { COLORS } from './UserSetup'

const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.id, c.hex]))

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function HighlightCard({ highlight, bookId, user, isActive, onClick, onDelete }) {
  const [comments, setComments] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!expanded) return
    const unsub = subscribeComments(bookId, highlight.id, setComments)
    return unsub
  }, [expanded, bookId, highlight.id])

  // Auto-expand when this highlight is focused from the reader
  useEffect(() => {
    if (isActive) {
      setExpanded(true)
      inputRef.current?.focus()
    }
  }, [isActive])

  async function postComment() {
    if (!user.signedIn || !draft.trim() || posting) return
    setPosting(true)
    await addComment(bookId, highlight.id, {
      text: draft.trim(),
      authorName: user.name,
      authorColor: user.color,
      authorUid: user.uid,
    })
    setDraft('')
    setPosting(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      postComment()
    }
  }

  const accentColor = COLOR_MAP[highlight.color] || '#FACC15'
  const isOwner = highlight.authorUid === user.uid

  return (
    <div
      className={`highlight-card ${isActive ? 'active' : ''}`}
      style={{ '--accent': accentColor }}
      onClick={() => {
        onClick(highlight.id)
        setExpanded(true)
      }}
    >
      <div className="highlight-strip" />
      <div className="highlight-card-body">
        <div className="highlight-quote">"{highlight.quote}"</div>
        <div className="highlight-meta">
          <span
            className="author-dot"
            style={{ background: accentColor }}
          />
          <span className="author-name">{highlight.authorName}</span>
          <span className="highlight-time">{timeAgo(highlight.createdAt)}</span>
          {isOwner && (
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(highlight.id)
              }}
              title="Delete highlight"
            >
              ×
            </button>
          )}
        </div>

        {/* Comment count / expand toggle */}
        <button
          className="comment-toggle"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {expanded ? '▲ Hide' : `💬 ${highlight.commentCount ?? 0} comment${(highlight.commentCount ?? 0) !== 1 ? 's' : ''}`}
        </button>

        {expanded && (
          <div className="comment-thread" onClick={(e) => e.stopPropagation()}>
            {comments.length === 0 && (
              <p className="no-comments">No comments yet. Be the first!</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <span
                  className="author-dot small"
                  style={{ background: COLOR_MAP[c.authorColor] || '#aaa' }}
                />
                <div className="comment-content">
                  <span className="comment-author">{c.authorName}</span>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  {c.authorUid === user.uid && (
                    <button
                      className="delete-btn small"
                      onClick={() => deleteComment(bookId, highlight.id, c.id)}
                    >
                      ×
                    </button>
                  )}
                  <p className="comment-text">{c.text}</p>
                </div>
              </div>
            ))}

            {user.signedIn ? (
              <div className="comment-input-row">
                <span
                  className="author-dot small"
                  style={{ background: accentColor }}
                />
                <textarea
                  ref={inputRef}
                  className="comment-input"
                  placeholder="Add a comment… (⌘↵ to post)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                />
                <button
                  className="post-btn"
                  onClick={postComment}
                  disabled={!draft.trim() || posting}
                >
                  Post
                </button>
              </div>
            ) : (
              <p className="comment-signin-note">
                Sign in with Google to join the discussion.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommentSidebar({
  bookId,
  highlights,
  activeHighlightId,
  user,
  onHighlightClick,
  onHighlightDelete,
}) {
  return (
    <aside className="comment-sidebar">
      <div className="sidebar-header">
        <h2>Highlights & Notes</h2>
        <span className="highlight-count">{highlights.length}</span>
      </div>

      {highlights.length === 0 ? (
        <div className="sidebar-empty">
          <p>Select any text in the book to add your first highlight.</p>
        </div>
      ) : (
        <div className="highlight-list">
          {highlights.map((hl) => (
            <HighlightCard
              key={hl.id}
              highlight={hl}
              bookId={bookId}
              user={user}
              isActive={hl.id === activeHighlightId}
              onClick={onHighlightClick}
              onDelete={onHighlightDelete}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
