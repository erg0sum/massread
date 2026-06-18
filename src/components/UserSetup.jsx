import { useState, useEffect } from 'react'

const COLORS = [
  { id: 'yellow', label: 'Yellow', hex: '#FACC15' },
  { id: 'green', label: 'Green', hex: '#4ADE80' },
  { id: 'pink', label: 'Pink', hex: '#F472B6' },
  { id: 'blue', label: 'Blue', hex: '#60A5FA' },
  { id: 'orange', label: 'Orange', hex: '#FB923C' },
]

export default function UserSetup({ onSetup, onGoogleSignIn, googleDisplayName = '', isAdmin = false }) {
  const [name, setName] = useState(googleDisplayName)
  const [color, setColor] = useState(COLORS[0].id)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  // Pre-fill name once the redirect result resolves after page load
  useEffect(() => {
    if (googleDisplayName) setName(googleDisplayName)
  }, [googleDisplayName])

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSetup({ name: name.trim(), color, isAdmin })
  }

  async function handleGoogleSignIn() {
    if (!onGoogleSignIn) return
    setGoogleLoading(true)
    setGoogleError('')
    try {
      await onGoogleSignIn() // initiates redirect — page navigates away
    } catch (err) {
      setGoogleError('Google sign-in failed. Please try again.')
      setGoogleLoading(false)
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
        <h1>Join the reading</h1>
        <p>You're about to read <em>The Great Gatsby</em> with others.<br />Set up your reader profile to get started.</p>

        {onGoogleSignIn && (
          <div className="google-signin-section">
            <button
              type="button"
              className="btn-google"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </button>
            {googleError && <p className="google-signin-error">{googleError}</p>}
            <div className="setup-divider"><span>or</span></div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="reader-name">Your nickname</label>
          <input
            id="reader-name"
            type="text"
            placeholder="e.g. Jay Gatsby"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoFocus={!onGoogleSignIn}
          />

          <label>Highlight color</label>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`color-swatch ${color === c.id ? 'selected' : ''}`}
                style={{ '--swatch': c.hex }}
                onClick={() => setColor(c.id)}
                title={c.label}
                aria-label={c.label}
              />
            ))}
          </div>

          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Start Reading →
          </button>
        </form>
      </div>
    </div>
  )
}

export { COLORS }
