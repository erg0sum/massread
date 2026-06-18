import { useEffect, useRef, useState, useCallback } from 'react'
import ePub from 'epubjs'
import { COLORS } from './UserSetup'

const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.id, c.hex]))

// Convert a hex color to a transparent rgba for highlight fill
function hexToRgba(hex, alpha = 0.35) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function BookReader({
  bookUrl,
  highlights,
  activeHighlightId,
  userColor,
  isAdmin,
  homework,
  onHighlightCreated,
  onHighlightClick,
  onHighlightDelete,
  onSetHomework,
  onClearHomework,
}) {
  const viewerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)
  const [toc, setToc] = useState([])
  const [currentSection, setCurrentSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectionPopup, setSelectionPopup] = useState(null) // { cfiRange, x, y }
  const appliedHighlightsRef = useRef(new Set())
  const [hwStart, setHwStart] = useState('')
  const [hwEnd, setHwEnd] = useState('')

  // ── Boot epub.js ──────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current || !bookUrl) return

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
      const items = nav.toc || []
      setToc(items)
      if (items.length > 0) {
        setHwStart(items[0].href)
        setHwEnd(items[items.length - 1].href)
      }
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

    rendition.display()

    // Track section title
    rendition.on('relocated', (location) => {
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
    if (!selectionPopup) return
    onHighlightCreated(selectionPopup.cfiRange)
    setSelectionPopup(null)
    // Clear epub.js selection
    renditionRef.current?.getContents()?.forEach((c) => {
      c.window.getSelection()?.removeAllRanges()
    })
  }, [selectionPopup, onHighlightCreated])

  const dismissPopup = useCallback(() => {
    setSelectionPopup(null)
  }, [])

  // ── Homework ─────────────────────────────────────────────────
  function handleSetHomework() {
    const startItem = toc.find((t) => t.href === hwStart)
    const endItem = toc.find((t) => t.href === hwEnd)
    if (!startItem || !endItem) return
    onSetHomework({
      startHref: startItem.href,
      startLabel: startItem.label?.trim(),
      endHref: endItem.href,
      endLabel: endItem.label?.trim(),
    })
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
      <aside className="toc-panel">
        <div className="toc-header">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="5" fill="#7C3AED" />
            <text x="16" y="23" fontFamily="serif" fontSize="20" fill="white" textAnchor="middle">M</text>
          </svg>
          <span className="toc-title">MassRead</span>
        </div>
        <div className="toc-book-title">The Great Gatsby</div>
        <div className="toc-author">F. Scott Fitzgerald</div>
        <nav className="toc-list">
          {toc.map((item) => (
            <button
              key={item.id || item.href}
              className="toc-item"
              onClick={() => jumpTo(item.href)}
            >
              {item.label?.trim()}
            </button>
          ))}
        </nav>

        {isAdmin && toc.length > 0 && (
          <div className="homework-admin">
            <div className="homework-admin-title">Set Homework</div>
            <label className="homework-admin-label">From</label>
            <select
              className="homework-select"
              value={hwStart}
              onChange={(e) => setHwStart(e.target.value)}
            >
              {toc.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label?.trim()}
                </option>
              ))}
            </select>
            <label className="homework-admin-label">To</label>
            <select
              className="homework-select"
              value={hwEnd}
              onChange={(e) => setHwEnd(e.target.value)}
            >
              {toc.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label?.trim()}
                </option>
              ))}
            </select>
            <div className="homework-admin-actions">
              <button className="homework-set-btn" onClick={handleSetHomework}>
                Assign
              </button>
              {homework && (
                <button className="homework-clear-btn" onClick={onClearHomework}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

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
            <span className="homework-banner-label">Homework</span>
            <span className="homework-banner-range">
              {homework.startLabel} — {homework.endLabel}
            </span>
            <button
              className="homework-jump-btn"
              onClick={() => jumpTo(homework.startHref)}
            >
              Jump to start
            </button>
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
            <button className="popup-highlight-btn" onClick={confirmHighlight}>
              <span
                className="popup-color-dot"
                style={{ background: COLOR_MAP[userColor] }}
              />
              Highlight
            </button>
            <button className="popup-dismiss" onClick={dismissPopup}>
              ✕
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
