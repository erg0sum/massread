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
  signInWithGoogle,
} from './firebase'
import './styles/global.css'

const BOOK_ID = import.meta.env.VITE_BOOK_ID || 'great-gatsby'
const BOOK_URL = '/gatsby.epub'

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [activeHighlightId, setActiveHighlightId] = useState(null)
  const [homework, setHomeworkState] = useState(null)

  useEffect(() => {
    const unsub = onUser((fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const isGoogle = fbUser.providerData?.some(p => p.providerId === 'google.com')
        const adminAuthed = sessionStorage.getItem('admin-authed') === '1'
        if (isGoogle && adminAuthed) {
          sessionStorage.removeItem('google-pending')
          setUser(prev => prev ?? {
            uid: fbUser.uid,
            name: fbUser.displayName || 'Admin',
            color: COLORS[fbUser.uid.charCodeAt(0) % COLORS.length].id,
            isAdmin: true,
          })
        }
      } else if (!sessionStorage.getItem('google-pending')) {
        signInAnon()
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeHighlights(BOOK_ID, setHighlights)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeHomework(BOOK_ID, setHomeworkState)
    return unsub
  }, [])

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

  const handleSetHomework = useCallback((data) => setHomework(BOOK_ID, data), [])
  const handleClearHomework = useCallback(() => clearHomework(BOOK_ID), [])

  if (!authed) return <AdminLogin onAuth={handleAdminAuth} />
  if (!user) return (
    <UserSetup
      onSetup={handleSetup}
      onGoogleSignIn={signInWithGoogle}
      isAdmin={true}
    />
  )

  return (
    <div className="app">
      <BookReader
        bookUrl={BOOK_URL}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        userColor={user.color}
        isAdmin={true}
        homework={homework}
        onHighlightCreated={handleHighlightCreated}
        onHighlightClick={setActiveHighlightId}
        onHighlightDelete={handleHighlightDelete}
        onSetHomework={handleSetHomework}
        onClearHomework={handleClearHomework}
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
