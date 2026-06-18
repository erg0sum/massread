import { useState, useEffect, useCallback } from 'react'
import BookReader from './components/BookReader'
import CommentSidebar from './components/CommentSidebar'
import UserSetup, { COLORS } from './components/UserSetup'
import AdminLogin from './components/AdminLogin'
import {
  signInAnon,
  onUser,
  subscribeHighlights,
  addHighlight,
  deleteHighlight,
  subscribeHomework,
  setHomework,
  clearHomework,
  subscribeActiveBook,
  setActiveBook,
  signInWithGoogle,
} from './firebase'
import { BOOKS, getBook, DEFAULT_BOOK_ID } from './books'
import './styles/global.css'

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [activeHighlightId, setActiveHighlightId] = useState(null)
  const [homework, setHomeworkState] = useState(null)
  const [activeBookId, setActiveBookId] = useState(DEFAULT_BOOK_ID)
  const [adminError, setAdminError] = useState('')
  const activeBook = getBook(activeBookId)

  // Google sign-in uses signInWithPopup, which resolves in-page and fires
  // onAuthStateChanged with the Google user — no redirect handshake needed.
  useEffect(() => {
    const unsub = onUser((fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const isGoogle = fbUser.providerData?.some(p => p.providerId === 'google.com')
        const adminAuthed = sessionStorage.getItem('admin-authed') === '1'
        if (isGoogle && adminAuthed) {
          setUser(prev => prev ?? {
            uid: fbUser.uid,
            name: fbUser.displayName || 'Admin',
            color: COLORS[fbUser.uid.charCodeAt(0) % COLORS.length].id,
            isAdmin: true,
          })
        }
      } else {
        signInAnon()
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeActiveBook((id) => {
      if (id) setActiveBookId(id)
    })
    return unsub
  }, [])

  useEffect(() => {
    setHighlights([])
    setActiveHighlightId(null)
    const unsub = subscribeHighlights(activeBookId, setHighlights)
    return unsub
  }, [activeBookId])

  useEffect(() => {
    setHomeworkState(null)
    const unsub = subscribeHomework(activeBookId, setHomeworkState)
    return unsub
  }, [activeBookId])

  function handleAdminAuth() {
    sessionStorage.setItem('admin-authed', '1')
    setAuthed(true)
  }

  function handleSetup({ name, color }) {
    if (!firebaseUser) return
    setUser({ uid: firebaseUser.uid, name, color, isAdmin: true })
  }

  const handleHighlightCreated = useCallback(
    async (cfiRange) => {
      if (!user) return
      const quote = window.__lastSelectionText?.slice(0, 240) || cfiRange
      await addHighlight(activeBookId, {
        cfiRange,
        quote,
        color: user.color,
        authorName: user.name,
        authorUid: user.uid,
        commentCount: 0,
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

  // Admin writes can be rejected by Firestore rules if this account isn't a
  // registered admin. Catch so a denied write surfaces a message instead of
  // an uncaught promise rejection.
  function describeWriteError(err) {
    if (err?.code === 'permission-denied') {
      return `Permission denied — this account isn't registered as an admin. ` +
        `In Firestore, create a document at admins/${firebaseUser?.uid ?? '<your-uid>'} (it can be empty) to fix it.`
    }
    return err?.message || 'Something went wrong saving your change.'
  }

  const handleSetHomework = useCallback(async (data) => {
    try {
      await setHomework(activeBookId, data)
      setAdminError('')
    } catch (err) {
      setAdminError(describeWriteError(err))
    }
  }, [activeBookId])

  const handleClearHomework = useCallback(async () => {
    try {
      await clearHomework(activeBookId)
      setAdminError('')
    } catch (err) {
      setAdminError(describeWriteError(err))
    }
  }, [activeBookId])

  const handleSetActiveBook = useCallback(async (id) => {
    try {
      await setActiveBook(id)
      setAdminError('')
    } catch (err) {
      setAdminError(describeWriteError(err))
    }
  }, [])

  if (!authed) return <AdminLogin onAuth={handleAdminAuth} />
  if (!user) return (
    <UserSetup
      onSetup={handleSetup}
      onGoogleSignIn={signInWithGoogle}
      isAdmin={true}
      bookTitle={activeBook.title}
    />
  )

  return (
    <div className="app">
      <BookReader
        bookUrl={activeBook.url}
        bookTitle={activeBook.title}
        bookAuthor={activeBook.author}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        userColor={user.color}
        isAdmin={true}
        homework={homework}
        books={BOOKS}
        activeBookId={activeBookId}
        adminError={adminError}
        onHighlightCreated={handleHighlightCreated}
        onHighlightClick={setActiveHighlightId}
        onHighlightDelete={handleHighlightDelete}
        onSetHomework={handleSetHomework}
        onClearHomework={handleClearHomework}
        onSetActiveBook={handleSetActiveBook}
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
