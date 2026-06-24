import { useState, useEffect, useCallback } from 'react'
import BookReader from './components/BookReader'
import CommentSidebar from './components/CommentSidebar'
import UserSetup, { COLORS } from './components/UserSetup'
import AdminGate from './components/AdminGate'
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
  logOut,
  isRegisteredAdmin,
  getUserProfile,
  saveUserProfile,
} from './firebase'
import { BOOKS, getBook, DEFAULT_BOOK_ID } from './books'
import { randomNickname } from './nickname'
import './styles/global.css'

export default function AdminApp() {
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  // null = not yet checked, true/false = registry result
  const [adminStatus, setAdminStatus] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [activeHighlightId, setActiveHighlightId] = useState(null)
  const [homework, setHomeworkState] = useState(null)
  const [activeBookId, setActiveBookId] = useState(DEFAULT_BOOK_ID)
  const [adminError, setAdminError] = useState('')
  const [suggestedNickname, setSuggestedNickname] = useState('')
  const [savedProfile, setSavedProfile] = useState(null)
  const activeBook = getBook(activeBookId)

  const isGoogleUser = firebaseUser?.providerData?.some(p => p.providerId === 'google.com')

  // Track auth. Admin status comes from the Firestore `admins` registry, which
  // is the real, server-enforced source of truth — there is no client secret.
  useEffect(() => {
    const unsub = onUser((fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const isGoogle = fbUser.providerData?.some(p => p.providerId === 'google.com')
        if (isGoogle) {
          getUserProfile(fbUser.uid).then((profile) => {
            setSavedProfile(profile)
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

  // Once a Google user is present, check whether their UID is a registered admin
  useEffect(() => {
    if (!firebaseUser || !isGoogleUser) {
      setAdminStatus(null)
      return
    }
    let cancelled = false
    setAdminStatus(null)
    isRegisteredAdmin(firebaseUser.uid).then((ok) => {
      if (!cancelled) setAdminStatus(ok)
    })
    return () => { cancelled = true }
  }, [firebaseUser, isGoogleUser])

  // A returning admin with a saved profile skips the nickname screen
  useEffect(() => {
    if (adminStatus === true && !user && firebaseUser && savedProfile?.nickname) {
      setUser({
        uid: firebaseUser.uid,
        name: savedProfile.nickname,
        color: savedProfile.color || COLORS[0].id,
        isAdmin: true,
        signedIn: true,
      })
    }
  }, [adminStatus, user, firebaseUser, savedProfile])

  // Wait for auth — Firestore rules require a signed-in user to read.
  useEffect(() => {
    if (!firebaseUser) return
    const unsub = subscribeActiveBook((id) => {
      if (id) setActiveBookId(id)
    })
    return unsub
  }, [firebaseUser])

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

  function handleSetup({ name, color }) {
    if (!firebaseUser) return
    const signedIn = firebaseUser.providerData?.some(p => p.providerId === 'google.com')
    setUser({ uid: firebaseUser.uid, name, color, isAdmin: true, signedIn: !!signedIn })
    if (signedIn) saveUserProfile(firebaseUser.uid, { nickname: name, color }).catch(() => {})
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

  async function handleLogOut() {
    setUser(null)
    setSuggestedNickname('')
    setSavedProfile(null)
    setAdminStatus(null)
    await logOut() // onUser(null) then re-signs in anonymously
  }

  // Admin gate: must sign in with Google and be in the `admins` registry
  if (!firebaseUser || !isGoogleUser) {
    return <AdminGate status="signin" onGoogleSignIn={signInWithGoogle} />
  }
  if (adminStatus === null) {
    return <AdminGate status="checking" />
  }
  if (adminStatus === false) {
    return <AdminGate status="denied" uid={firebaseUser.uid} onLogOut={handleLogOut} />
  }

  // Registered admin — pick a nickname, then read
  if (!user) return (
    <UserSetup
      onSetup={handleSetup}
      onGoogleSignIn={signInWithGoogle}
      suggestedNickname={suggestedNickname}
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
        userName={user.name}
        canHighlight={user.signedIn}
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
