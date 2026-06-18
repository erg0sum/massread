import { useState, useEffect, useCallback } from 'react'
import BookReader from './components/BookReader'
import CommentSidebar from './components/CommentSidebar'
import UserSetup, { COLORS } from './components/UserSetup'
import {
  signInAnon,
  onUser,
  subscribeHighlights,
  addHighlight,
  deleteHighlight,
  subscribeHomework,
  signInWithGoogle,
} from './firebase'
import './styles/global.css'

const BOOK_ID = import.meta.env.VITE_BOOK_ID || 'great-gatsby'
const BOOK_URL = '/gatsby.epub' // Place your epub in /public/gatsby.epub

export default function App() {
  const [user, setUser] = useState(null)         // { uid, name, color, isAdmin }
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [activeHighlightId, setActiveHighlightId] = useState(null)
  const [homework, setHomeworkState] = useState(null)

  // ── Firebase auth ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onUser((fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const isGoogle = fbUser.providerData?.some(p => p.providerId === 'google.com')
        if (isGoogle) {
          sessionStorage.removeItem('google-pending')
          setUser(prev => prev ?? {
            uid: fbUser.uid,
            name: fbUser.displayName || 'Reader',
            color: COLORS[fbUser.uid.charCodeAt(0) % COLORS.length].id,
          })
        }
      } else if (!sessionStorage.getItem('google-pending')) {
        signInAnon()
      }
    })
    return unsub
  }, [])

  // ── Subscribe to highlights and homework ──────────────────────
  useEffect(() => {
    const unsub = subscribeHighlights(BOOK_ID, setHighlights)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeHomework(BOOK_ID, setHomeworkState)
    return unsub
  }, [])

  // ── User setup callback ───────────────────────────────────────
  function handleSetup({ name, color }) {
    if (!firebaseUser) return
    setUser({ uid: firebaseUser.uid, name, color })
  }

  // ── Highlight created from reader selection ───────────────────
  const handleHighlightCreated = useCallback(
    async (cfiRange) => {
      if (!user) return
      // Get the selected text from the CFI — we stored it on the rendition event
      // We'll truncate for display
      const quote = window.__lastSelectionText?.slice(0, 240) || cfiRange
      await addHighlight(BOOK_ID, {
        cfiRange,
        quote,
        color: user.color,
        authorName: user.name,
        authorUid: user.uid,
        commentCount: 0,
      })
    },
    [user]
  )

  const handleHighlightDelete = useCallback(
    async (highlightId) => {
      await deleteHighlight(BOOK_ID, highlightId)
      if (activeHighlightId === highlightId) setActiveHighlightId(null)
    },
    [activeHighlightId]
  )

  if (!user) {
    return (
      <UserSetup
        onSetup={handleSetup}
        onGoogleSignIn={signInWithGoogle}
      />
    )
  }

  return (
    <div className="app">
      <BookReader
        bookUrl={BOOK_URL}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        userColor={user.color}
        homework={homework}
        onHighlightCreated={handleHighlightCreated}
        onHighlightClick={setActiveHighlightId}
        onHighlightDelete={handleHighlightDelete}
      />
      <CommentSidebar
        bookId={BOOK_ID}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        user={user}
        onHighlightClick={setActiveHighlightId}
        onHighlightDelete={handleHighlightDelete}
      />
    </div>
  )
}
