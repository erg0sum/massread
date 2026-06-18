import { useState, useEffect, useCallback } from 'react'
import BookReader from './components/BookReader'
import CommentSidebar from './components/CommentSidebar'
import UserSetup from './components/UserSetup'
import {
  signInAnon,
  onUser,
  subscribeHighlights,
  addHighlight,
  deleteHighlight,
  subscribeHomework,
  subscribeActiveBook,
  signInWithGoogle,
  logOut,
} from './firebase'
import { getBook, DEFAULT_BOOK_ID } from './books'
import './styles/global.css'

export default function App() {
  const [user, setUser] = useState(null)         // { uid, name, color, isAdmin }
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [activeHighlightId, setActiveHighlightId] = useState(null)
  const [homework, setHomeworkState] = useState(null)
  const [activeBookId, setActiveBookId] = useState(DEFAULT_BOOK_ID)
  const [googleDisplayName, setGoogleDisplayName] = useState('')
  const activeBook = getBook(activeBookId)

  // ── Firebase auth ─────────────────────────────────────────────
  // Google sign-in uses signInWithPopup, which resolves in-page and fires
  // onAuthStateChanged with the Google user. We prefill the nickname from the
  // Google profile but still let them confirm/change it on the setup screen.
  useEffect(() => {
    const unsub = onUser((fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const isGoogle = fbUser.providerData?.some(p => p.providerId === 'google.com')
        setGoogleDisplayName(isGoogle ? (fbUser.displayName || '') : '')
      } else {
        signInAnon()
      }
    })
    return unsub
  }, [])

  // ── Subscribe to the admin's active book choice ───────────────
  // Wait for auth — Firestore rules require a signed-in user to read.
  useEffect(() => {
    if (!firebaseUser) return
    const unsub = subscribeActiveBook((id) => {
      if (id) setActiveBookId(id)
    })
    return unsub
  }, [firebaseUser])

  // ── Subscribe to highlights and homework for the active book ──
  useEffect(() => {
    if (!firebaseUser) return
    setHighlights([])
    setActiveHighlightId(null)
    const unsub = subscribeHighlights(activeBookId, setHighlights)
    return unsub
  }, [firebaseUser, activeBookId])

  useEffect(() => {
    if (!firebaseUser) return
    setHomeworkState(null)
    const unsub = subscribeHomework(activeBookId, setHomeworkState)
    return unsub
  }, [firebaseUser, activeBookId])

  // ── User setup callback ───────────────────────────────────────
  function handleSetup({ name, color }) {
    if (!firebaseUser) return
    const signedIn = firebaseUser.providerData?.some(p => p.providerId === 'google.com')
    setUser({ uid: firebaseUser.uid, name, color, signedIn: !!signedIn })
  }

  async function handleLogOut() {
    setUser(null)
    setGoogleDisplayName('')
    await logOut() // onUser(null) then re-signs in anonymously
  }

  // ── Highlight created from reader selection ───────────────────
  const handleHighlightCreated = useCallback(
    async (cfiRange) => {
      if (!user) return
      // Get the selected text from the CFI — we stored it on the rendition event
      // We'll truncate for display
      const quote = window.__lastSelectionText?.slice(0, 240) || cfiRange
      await addHighlight(activeBookId, {
        cfiRange,
        quote,
        color: user.color,
        authorName: user.name,
        authorUid: user.uid,
      })
    },
    [user, activeBookId]
  )

  const handleHighlightDelete = useCallback(
    async (highlightId) => {
      await deleteHighlight(activeBookId, highlightId)
      if (activeHighlightId === highlightId) setActiveHighlightId(null)
    },
    [activeHighlightId, activeBookId]
  )

  if (!user) {
    return (
      <UserSetup
        onSetup={handleSetup}
        onGoogleSignIn={signInWithGoogle}
        googleDisplayName={googleDisplayName}
        bookTitle={activeBook.title}
      />
    )
  }

  return (
    <div className="app">
      <BookReader
        bookUrl={activeBook.url}
        bookTitle={activeBook.title}
        bookAuthor={activeBook.author}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        userColor={user.color}
        userName={user.name}
        canHighlight={user.signedIn}
        homework={homework}
        onHighlightCreated={handleHighlightCreated}
        onHighlightClick={setActiveHighlightId}
        onHighlightDelete={handleHighlightDelete}
        onLogOut={handleLogOut}
      />
      <CommentSidebar
        bookId={activeBookId}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        user={user}
        onHighlightClick={setActiveHighlightId}
        onHighlightDelete={handleHighlightDelete}
      />
    </div>
  )
}
