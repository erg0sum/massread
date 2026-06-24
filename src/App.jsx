import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  getUserProfile,
  saveUserProfile,
} from './firebase'
import { BOOKS, getBook, DEFAULT_BOOK_ID } from './books'
import { randomNickname } from './nickname'
import './styles/global.css'

export default function App() {
  const [searchParams] = useSearchParams()
  // Deep link: ?book=<id> pins the reader to a specific book, overriding the
  // admin's global active-book choice. Ignored if the id isn't in the catalog.
  const bookParam = searchParams.get('book')
  const deeplinkBookId = BOOKS.some((b) => b.id === bookParam) ? bookParam : null

  const [user, setUser] = useState(null)         // { uid, name, color, isAdmin }
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [activeHighlightId, setActiveHighlightId] = useState(null)
  const [homework, setHomeworkState] = useState(null)
  const [activeBookId, setActiveBookId] = useState(deeplinkBookId || DEFAULT_BOOK_ID)
  const [suggestedNickname, setSuggestedNickname] = useState('')
  const activeBook = getBook(activeBookId)

  // ── Firebase auth ─────────────────────────────────────────────
  // Google sign-in uses signInWithPopup, which resolves in-page and fires
  // onAuthStateChanged with the Google user. For Google users we suggest a
  // nickname: their saved one if they've set it before, otherwise a random one.
  useEffect(() => {
    const unsub = onUser((fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const isGoogle = fbUser.providerData?.some(p => p.providerId === 'google.com')
        if (isGoogle) {
          getUserProfile(fbUser.uid).then((profile) => {
            setSuggestedNickname(profile?.nickname || randomNickname())
          })
        } else {
          setSuggestedNickname('')
        }
      } else {
        signInAnon()
      }
    })
    return unsub
  }, [])

  // ── Deep-linked book wins over the global active book ─────────
  useEffect(() => {
    if (deeplinkBookId) setActiveBookId(deeplinkBookId)
  }, [deeplinkBookId])

  // ── Subscribe to the admin's active book choice ───────────────
  // Wait for auth — Firestore rules require a signed-in user to read.
  // Skipped when a deep link pins a specific book.
  useEffect(() => {
    if (!firebaseUser || deeplinkBookId) return
    const unsub = subscribeActiveBook((id) => {
      if (id) setActiveBookId(id)
    })
    return unsub
  }, [firebaseUser, deeplinkBookId])

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
    // Persist signed-in users' nickname so it's suggested on their next visit
    if (signedIn) saveUserProfile(firebaseUser.uid, { nickname: name, color }).catch(() => {})
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
        suggestedNickname={suggestedNickname}
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
        books={BOOKS}
        activeBookId={activeBookId}
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
