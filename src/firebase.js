// ─────────────────────────────────────────────────────────────
//  FIREBASE CONFIG
//  Replace the values below with your own Firebase project config.
//  Console: https://console.firebase.google.com
//
//  Firestore rules (paste into Firebase console → Firestore → Rules):
//
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//      match /books/{bookId} {
//        // Highlights require a non-anonymous (signed-in) user to create
//        match /highlights/{highlightId} {
//          allow read: if request.auth != null;
//          allow create: if request.auth != null
//            && request.auth.token.firebase.sign_in_provider != 'anonymous'
//            && request.resource.data.authorUid == request.auth.uid;
//          allow delete: if request.auth != null
//            && resource.data.authorUid == request.auth.uid;
//          // Comments require a non-anonymous (signed-in) user to create
//          match /comments/{commentId} {
//            allow read: if request.auth != null;
//            allow create: if request.auth != null
//              && request.auth.token.firebase.sign_in_provider != 'anonymous'
//              && request.resource.data.authorUid == request.auth.uid;
//            allow delete: if request.auth != null
//              && resource.data.authorUid == request.auth.uid;
//          }
//        }
//        match /meta/homework {
//          allow read: if request.auth != null;
//          allow write: if request.auth != null
//            && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
//        }
//      }
//      // Global app config (e.g. the active book): anyone reads, admins write
//      match /app/config {
//        allow read: if request.auth != null;
//        allow write: if request.auth != null
//          && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
//      }
//      // Admin registry: create docs here manually via Firebase console
//      // Document ID = the admin's Firebase UID, content can be empty
//      match /admins/{uid} {
//        allow read: if request.auth != null && request.auth.uid == uid;
//        allow write: if false;
//      }
//    }
//  }
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

// ── Auth ──────────────────────────────────────────────────────

export function signInAnon() {
  return signInAnonymously(auth)
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export function onUser(cb) {
  return onAuthStateChanged(auth, cb)
}

export function logOut() {
  return signOut(auth)
}

// True if the signed-in user's UID has a document in the `admins` collection.
// Rules allow a user to read only their own admins/{uid} doc.
export async function isRegisteredAdmin(uid) {
  if (!uid) return false
  try {
    const snap = await getDoc(doc(db, 'admins', uid))
    return snap.exists()
  } catch {
    return false
  }
}

// ── Active book (global config) ───────────────────────────────

function appConfigRef() {
  return doc(db, 'app', 'config')
}

export async function setActiveBook(bookId) {
  return setDoc(appConfigRef(), { activeBookId: bookId }, { merge: true })
}

// Snapshot errors (e.g. a permission-denied before auth settles) are otherwise
// logged by the SDK as "Uncaught"; swallow them quietly — the listener resubscribes.
function onSnapError(label) {
  return (err) => {
    if (err?.code !== 'permission-denied') {
      console.warn(`Firestore listener (${label}) error:`, err)
    }
  }
}

export function subscribeActiveBook(cb) {
  return onSnapshot(appConfigRef(), (snap) => {
    cb(snap.exists() ? snap.data().activeBookId ?? null : null)
  }, onSnapError('activeBook'))
}

// ── Highlights ────────────────────────────────────────────────

export function highlightsRef(bookId) {
  return collection(db, 'books', bookId, 'highlights')
}

export async function addHighlight(bookId, data) {
  return addDoc(highlightsRef(bookId), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function deleteHighlight(bookId, highlightId) {
  return deleteDoc(doc(db, 'books', bookId, 'highlights', highlightId))
}

export function subscribeHighlights(bookId, cb) {
  const q = query(highlightsRef(bookId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    const highlights = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    cb(highlights)
  }, onSnapError('highlights'))
}

// ── Comments ──────────────────────────────────────────────────

export function commentsRef(bookId, highlightId) {
  return collection(db, 'books', bookId, 'highlights', highlightId, 'comments')
}

export async function addComment(bookId, highlightId, data) {
  return addDoc(commentsRef(bookId, highlightId), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function deleteComment(bookId, highlightId, commentId) {
  return deleteDoc(
    doc(db, 'books', bookId, 'highlights', highlightId, 'comments', commentId)
  )
}

// ── Homework ──────────────────────────────────────────────────

function homeworkRef(bookId) {
  return doc(db, 'books', bookId, 'meta', 'homework')
}

export async function setHomework(bookId, data) {
  return setDoc(homeworkRef(bookId), data)
}

export async function clearHomework(bookId) {
  return deleteDoc(homeworkRef(bookId))
}

export function subscribeHomework(bookId, cb) {
  return onSnapshot(homeworkRef(bookId), (snap) => {
    cb(snap.exists() ? snap.data() : null)
  }, onSnapError('homework'))
}

export function subscribeComments(bookId, highlightId, cb) {
  const q = query(commentsRef(bookId, highlightId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    cb(comments)
  }, onSnapError('comments'))
}
