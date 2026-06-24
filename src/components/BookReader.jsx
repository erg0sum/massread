import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import ePub from 'epubjs'
import { usePersistentState, isMobileViewport } from '../usePersistentState'
import { COLORS } from './UserSetup'

const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.id, c.hex]))

// epub.js nav.toc is a tree — chapters are often nested under a parent as
// `subitems`. Flatten it so every level is selectable, tagging each with its
// depth for indentation.
function flattenToc(items, depth = 0, out = []) {
  for (const item of items) {
    out.push({ href: item.href, label: item.label?.trim() || '', depth })
    if (item.subitems?.length) flattenToc(item.subitems, depth + 1, out)
  }
  return out
}

// Convert a hex color to a transparent rgba for highlight fill
function hexToRgba(hex, alpha = 0.35) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function BookReader({
  bookUrl,
  bookTitle,
  bookAuthor,
  highlights,
  activeHighlightId,
  userColor,
  userName,
  canHighlight,
  isAdmin,
  homework,
  books = [],
  activeBookId,
  adminError,
  onHighlightCreated,
  onHighlightClick,
  onHighlightDelete,
  onSetHomework,
  onClearHomework,
  onSetActiveBook,
  onLogOut,
}) {
  const viewerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)
  const [toc, setToc] = useState([])
  const [tocCollapsed, setTocCollapsed] = usePersistentState(
    'massread:tocCollapsed',
    isMobileViewport
  )
  const [currentSection, setCurrentSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectionPopup, setSelectionPopup] = useState(null) // { cfiRange, x, y }
  const appliedHighlightsRef = useRef(new Set())
  // True until we've decided the initial position; lets homework override the
  // default start only when there's no saved reading position.
  const pendingHomeworkJumpRef = useRef(false)
  const lastCfiKey = `massread:lastCfi:${bookUrl}`
  // Hrefs of the sections the admin has checked for homework
  const [hwSelected, setHwSelected] = useState(() => new Set())

  // Flattened table of contents (all nesting levels), for display and selects
  const flatToc = useMemo(() => flattenToc(toc), [toc])

  // Other catalog books, offered as deep links for readers who want a change
  const otherBooks = books.filter((b) => b.id !== activeBookId)

  // Seed the admin's homework checkboxes from the currently-assigned sections
  useEffect(() => {
    setHwSelected(new Set(homework?.sections?.map((s) => s.href) ?? []))
  }, [homework])

  // ── Boot epub.js ──────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current || !bookUrl) return

    // Fresh book — forget which highlights were applied to the previous one
    appliedHighlightsRef.current = new Set()
    setToc([])
    setLoading(true)

    const book = ePub(bookUrl)
    bookRef.current = book

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'scrolled-doc',
      allowScriptedContent: true,
    })
    renditionRef.current = rendition

    book.ready.then(() => {
      setLoading(false)
      return book.locations.generate(1000)
    })

    book.loaded.navigation.then((nav) => {
      setToc(nav.toc || [])
    })

    // Dark theme injected into the epub iframe
    rendition.themes.register('dark', {
      body: {
        background: '#1a1a24 !important',
        color: '#ddd8f0 !important',
        'font-family': 'Merriweather, Georgia, serif !important',
        'font-size': '17px !important',
        'line-height': '1.85 !important',
        'max-width': '680px',
        margin: '0 auto',
        padding: '32px 24px !important',
      },
      p: { 'margin-bottom': '1em' },
      a: { color: '#a78bfa' },
      'h1, h2, h3': { color: '#e8e8f0', 'margin-bottom': '0.75em' },
      '::selection': { background: 'rgba(124,58,237,0.35)' },
    })
    rendition.themes.select('dark')

    // Resume the last read position if we have one; otherwise start at the
    // default and let homework (once loaded) decide the opening location.
    let savedCfi = null
    try {
      savedCfi = localStorage.getItem(lastCfiKey)
    } catch {
      /* ignore */
    }
    pendingHomeworkJumpRef.current = !savedCfi
    if (savedCfi) rendition.display(savedCfi)
    else rendition.display()

    // Track section title + persist reading position
    rendition.on('relocated', (location) => {
      const cfi = location?.start?.cfi
      if (cfi) {
        try {
          localStorage.setItem(lastCfiKey, cfi)
        } catch {
          /* ignore */
        }
      }
      const href = location?.start?.href
      if (href && bookRef.current?.navigation) {
        const nav = bookRef.current.navigation
        const item = nav.get(href) || nav.toc?.find((t) => t.href?.includes(href))
        if (item) setCurrentSection(item.label?.trim() || '')
      }
    })

    // Text selection inside the epub iframe
    rendition.on('selected', (cfiRange, contents) => {
      const selection = contents.window.getSelection()
      if (!selection || selection.isCollapsed) {
        setSelectionPopup(null)
        return
      }
      // Capture quote text for Firestore
      window.__lastSelectionText = selection.toString()

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const iframeRect = viewerRef.current
        .querySelector('iframe')
        ?.getBoundingClientRect()
      if (!iframeRect) return

      const x = iframeRect.left + rect.left + rect.width / 2
      const y = iframeRect.top + rect.top - 12

      setSelectionPopup({ cfiRange, x, y })
    })

    // Click on a highlight
    rendition.on('markClicked', (cfiRange, data) => {
      onHighlightClick(data.highlightId)
    })

    return () => {
      rendition.destroy()
      book.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookUrl])

  // ── Sync highlights from Firestore → epub.js ──────────────────
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return

    const applied = appliedHighlightsRef.current
    const incoming = new Set(highlights.map((h) => h.id))

    // Remove highlights that no longer exist
    applied.forEach((id) => {
      if (!incoming.has(id)) {
        const hl = highlights.find((h) => h.id === id)
        // We don't have the cfi here after deletion — keep a local map
        applied.delete(id)
      }
    })

    highlights.forEach((hl) => {
      if (applied.has(hl.id)) return
      applied.add(hl.id)
      const hex = COLOR_MAP[hl.color] || '#FACC15'
      rendition.annotations.highlight(
        hl.cfiRange,
        { highlightId: hl.id },
        (e) => {
          onHighlightClick(hl.id)
        },
        'highlight-mark',
        {
          fill: hexToRgba(hex),
          'fill-opacity': '1',
          'mix-blend-mode': 'multiply',
        }
      )
    })
  }, [highlights, onHighlightClick])

  // On first load (no saved position), open at the homework start once it loads
  useEffect(() => {
    if (!pendingHomeworkJumpRef.current || !renditionRef.current) return
    const first = homework?.sections?.[0]?.href
    if (first) {
      pendingHomeworkJumpRef.current = false
      renditionRef.current.display(first)?.catch?.(() => {})
    }
  }, [homework])

  // Scroll active highlight into view when sidebar selects one
  useEffect(() => {
    if (!activeHighlightId || !renditionRef.current) return
    const hl = highlights.find((h) => h.id === activeHighlightId)
    if (hl) {
      renditionRef.current.display(hl.cfiRange).catch(() => {})
    }
  }, [activeHighlightId, highlights])

  // ── Confirm highlight ────────────────────────────────────────
  const confirmHighlight = useCallback(() => {
    if (!selectionPopup || !canHighlight) return
    onHighlightCreated(selectionPopup.cfiRange)
    setSelectionPopup(null)
    // Clear epub.js selection
    renditionRef.current?.getContents()?.forEach((c) => {
      c.window.getSelection()?.removeAllRanges()
    })
  }, [selectionPopup, canHighlight, onHighlightCreated])

  const dismissPopup = useCallback(() => {
    setSelectionPopup(null)
  }, [])

  // ── Homework ─────────────────────────────────────────────────
  function toggleSection(href) {
    setHwSelected((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function handleSetHomework() {
    // Preserve reading order by filtering the flattened TOC
    const sections = flatToc
      .filter((t) => hwSelected.has(t.href))
      .map((t) => ({ href: t.href, label: t.label }))
    if (sections.length === 0) return
    onSetHomework({ sections })
  }

  // ── Share ────────────────────────────────────────────────────
  function handleCopyLink() {
    if (!activeBookId) return
    const url = `${window.location.origin}/?book=${activeBookId}`
    Promise.resolve(navigator.clipboard?.writeText(url))
      .then(() => {
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 1500)
      })
      .catch(() => {})
  }

  // ── Navigation ────────────────────────────────────────────────
  function prev() {
    renditionRef.current?.prev()
  }
  function next() {
    renditionRef.current?.next()
  }
  function jumpTo(href) {
    renditionRef.current?.display(href)
  }

  return (
    <div className="reader-layout">
      {/* TOC Sidebar */}
      {tocCollapsed ? (
        <aside className="toc-panel collapsed">
          <button
            className="sidebar-reopen"
            onClick={() => setTocCollapsed(false)}
            aria-label="Show table of contents"
            title="Show contents"
          >
            <span className="sidebar-reopen-label">Contents</span>
            <span className="sidebar-reopen-chevron" aria-hidden="true">›</span>
          </button>
        </aside>
      ) : (
      <aside className="toc-panel">
        <div className="toc-header">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="5" fill="#7C3AED" />
            <text x="16" y="23" fontFamily="serif" fontSize="20" fill="white" textAnchor="middle">M</text>
          </svg>
          <span className="toc-title">MassRead</span>
          <button
            className="sidebar-collapse"
            onClick={() => setTocCollapsed(true)}
            aria-label="Hide table of contents"
            title="Hide contents"
          >
            ‹
          </button>
        </div>
        <div className="toc-book-title">{bookTitle}</div>
        <div className="toc-author">{bookAuthor}</div>
        <nav className="toc-list">
          {flatToc.map((item, i) => (
            <button
              key={`${item.href}-${i}`}
              className="toc-item"
              style={{ paddingLeft: `${16 + item.depth * 14}px` }}
              onClick={() => jumpTo(item.href)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {isAdmin && adminError && (
          <div className="admin-error">{adminError}</div>
        )}

        {isAdmin && onSetActiveBook && books.length > 0 && (
          <div className="homework-admin">
            <div className="homework-admin-title">Active Book</div>
            <select
              className="homework-select"
              value={activeBookId}
              onChange={(e) => onSetActiveBook(e.target.value)}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {isAdmin && toc.length > 0 && (
          <div className="homework-admin">
            <div className="homework-admin-title">Set Homework</div>
            <p className="homework-admin-hint">
              Pick any sections — they don't have to be next to each other.
            </p>
            <div className="homework-checklist">
              {flatToc.map((item, i) => (
                <label
                  key={`${item.href}-${i}`}
                  className="homework-check"
                  style={{ paddingLeft: `${item.depth * 14}px` }}
                >
                  <input
                    type="checkbox"
                    checked={hwSelected.has(item.href)}
                    onChange={() => toggleSection(item.href)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="homework-admin-actions">
              <button
                className="homework-set-btn"
                onClick={handleSetHomework}
                disabled={hwSelected.size === 0}
              >
                Assign{hwSelected.size > 0 ? ` (${hwSelected.size})` : ''}
              </button>
              {homework && (
                <button className="homework-clear-btn" onClick={onClearHomework}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {otherBooks.length > 0 && (
          <div className="other-books">
            <div className="other-books-title">
              Not interested in {bookTitle}? Try {otherBooks.length === 1 ? 'the following book' : 'one of these'}:
            </div>
            {otherBooks.map((b) => (
              <Link key={b.id} to={`/?book=${b.id}`} className="other-book-link">
                <span className="other-book-name">{b.title}</span>
                <span className="other-book-author">{b.author}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="toc-footer">
          {onLogOut && (
            <div className="toc-footer-row">
              {userName && (
                <span className="toc-user" title={userName}>
                  Reading as <strong>{userName}</strong>
                </span>
              )}
              <button className="logout-btn" onClick={onLogOut}>
                Log out
              </button>
            </div>
          )}
          {activeBookId && (
            <button className="copy-link-btn" onClick={handleCopyLink}>
              {linkCopied ? '✓ Link copied' : '🔗 Copy link to this book'}
            </button>
          )}
          <Link to="/terms" className="toc-terms">Terms of Use</Link>
        </div>
      </aside>
      )}

      {/* Book Viewer */}
      <main className="viewer-area">
        {loading && (
          <div className="reader-loading">
            <div className="spinner" />
            <p>Loading book…</p>
          </div>
        )}
        <div className="viewer-chrome">
          {currentSection && (
            <div className="section-label">{currentSection}</div>
          )}
        </div>

        {homework && (
          <div className="homework-banner">
            <span className="homework-banner-label">This Week's Reading</span>
            {homework.sections ? (
              <div className="homework-banner-sections">
                {homework.sections.map((s, i) => (
                  <button
                    key={`${s.href}-${i}`}
                    className="homework-section-chip"
                    onClick={() => jumpTo(s.href)}
                    title={`Jump to ${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <span className="homework-banner-range">
                  {homework.startLabel} — {homework.endLabel}
                </span>
                <button
                  className="homework-jump-btn"
                  onClick={() => jumpTo(homework.startHref)}
                >
                  Jump to start
                </button>
              </>
            )}
          </div>
        )}

        <div ref={viewerRef} className="epub-viewer" />
        <div className="nav-controls">
          <button className="nav-btn" onClick={prev} aria-label="Previous page">
            ‹
          </button>
          <button className="nav-btn" onClick={next} aria-label="Next page">
            ›
          </button>
        </div>

        {/* Selection popup */}
        {selectionPopup && (
          <div
            className="selection-popup"
            style={{
              left: selectionPopup.x,
              top: selectionPopup.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {canHighlight ? (
              <button className="popup-highlight-btn" onClick={confirmHighlight}>
                <span
                  className="popup-color-dot"
                  style={{ background: COLOR_MAP[userColor] }}
                />
                Highlight
              </button>
            ) : (
              <span className="popup-signin-note">Sign in with Google to highlight</span>
            )}
            <button className="popup-dismiss" onClick={dismissPopup}>
              ✕
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
