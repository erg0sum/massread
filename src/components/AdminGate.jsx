import { useState } from 'react'
import { Link } from 'react-router-dom'

// Gate shown on /admin before a registered admin reaches the reader.
// `status` is 'signin' (needs Google sign-in), 'checking' (verifying), or
// 'denied' (signed in but not in the admins registry).
export default function AdminGate({ status, uid, onGoogleSignIn, onLogOut }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    try {
      await onGoogleSignIn()
    } catch {
      setError('Google sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="user-setup-overlay">
      <div className="user-setup-card">
        <div className="user-setup-logo">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#7C3AED" />
            <text x="16" y="23" fontFamily="serif" fontSize="20" fill="white" textAnchor="middle">M</text>
          </svg>
          <span>MassRead</span>
        </div>
        <h1>Admin access</h1>

        {status === 'checking' && (
          <>
            <p>Checking admin access…</p>
            <div className="spinner" style={{ margin: '8px 0' }} />
          </>
        )}

        {status === 'denied' && (
          <>
            <p>
              You're signed in, but this account isn't registered as an admin.
            </p>
            <div className="admin-error">
              To grant access, create a Firestore document at{' '}
              <strong>admins/{uid}</strong> (it can be empty).
            </div>
            <button type="button" className="btn-primary" onClick={onLogOut}>
              Use a different account
            </button>
          </>
        )}

        {status === 'signin' && (
          <>
            <p>Sign in with Google to manage reading assignments.</p>
            <button
              type="button"
              className="btn-google"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>
            {error && <p className="google-signin-error">{error}</p>}
          </>
        )}

        <p className="setup-terms">
          <Link to="/terms">Terms of Use</Link>
        </p>
      </div>
    </div>
  )
}
