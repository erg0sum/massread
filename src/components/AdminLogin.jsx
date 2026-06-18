import { useState } from 'react'

const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE

export default function AdminLogin({ onAuth }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (ADMIN_CODE && code === ADMIN_CODE) {
      onAuth()
    } else {
      setError(true)
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
        <p>Enter the admin code to manage reading assignments.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-code">Admin code</label>
          <input
            id="admin-code"
            type="password"
            placeholder="Enter admin code"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(false) }}
            autoFocus
          />
          {error && (
            <p className="admin-login-error">Incorrect code. Try again.</p>
          )}
          <button type="submit" className="btn-primary" disabled={!code}>
            Continue →
          </button>
        </form>
      </div>
    </div>
  )
}
