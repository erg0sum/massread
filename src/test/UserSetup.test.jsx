import { describe, it, expect, vi } from 'vitest'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import UserSetup from '../components/UserSetup'

// UserSetup renders a <Link>, so it needs a Router context
const render = (ui) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

describe('UserSetup', () => {
  it('renders the nickname label', () => {
    render(<UserSetup onSetup={() => {}} />)
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument()
  })

  it('submit button is disabled when nickname is empty', () => {
    render(<UserSetup onSetup={() => {}} />)
    expect(screen.getByRole('button', { name: /start reading/i })).toBeDisabled()
  })

  it('submit button enables once a nickname is typed', async () => {
    const user = userEvent.setup()
    render(<UserSetup onSetup={() => {}} />)
    await user.type(screen.getByLabelText(/nickname/i), 'Daisy')
    expect(screen.getByRole('button', { name: /start reading/i })).toBeEnabled()
  })

  it('calls onSetup with trimmed name and selected color', async () => {
    const user = userEvent.setup()
    const onSetup = vi.fn()
    render(<UserSetup onSetup={onSetup} />)
    await user.type(screen.getByLabelText(/nickname/i), '  Nick  ')
    await user.click(screen.getByRole('button', { name: /start reading/i }))
    expect(onSetup).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nick', color: expect.any(String) })
    )
  })

  it('passes isAdmin=false by default', async () => {
    const user = userEvent.setup()
    const onSetup = vi.fn()
    render(<UserSetup onSetup={onSetup} />)
    await user.type(screen.getByLabelText(/nickname/i), 'Nick')
    await user.click(screen.getByRole('button', { name: /start reading/i }))
    expect(onSetup).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: false }))
  })

  it('passes isAdmin=true when the prop is set', async () => {
    const user = userEvent.setup()
    const onSetup = vi.fn()
    render(<UserSetup onSetup={onSetup} isAdmin={true} />)
    await user.type(screen.getByLabelText(/nickname/i), 'Nick')
    await user.click(screen.getByRole('button', { name: /start reading/i }))
    expect(onSetup).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true }))
  })

  it('does not submit when name is only whitespace', async () => {
    const user = userEvent.setup()
    const onSetup = vi.fn()
    render(<UserSetup onSetup={onSetup} />)
    await user.type(screen.getByLabelText(/nickname/i), '   ')
    expect(screen.getByRole('button', { name: /start reading/i })).toBeDisabled()
    expect(onSetup).not.toHaveBeenCalled()
  })

  // ── Google sign-in ─────────────────────────────────────────────
  it('does not show Google button when onGoogleSignIn is not provided', () => {
    render(<UserSetup onSetup={() => {}} />)
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
  })

  it('shows Google button when onGoogleSignIn prop is provided', () => {
    render(<UserSetup onSetup={() => {}} onGoogleSignIn={() => Promise.resolve('Ada')} />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('pre-fills nickname from suggestedNickname prop', () => {
    render(
      <UserSetup
        onSetup={() => {}}
        onGoogleSignIn={() => Promise.resolve()}
        suggestedNickname="Ada Lovelace"
      />
    )
    expect(screen.getByLabelText(/nickname/i)).toHaveValue('Ada Lovelace')
  })

  it('indicates the user is signed in once suggestedNickname is set', () => {
    render(
      <UserSetup
        onSetup={() => {}}
        onGoogleSignIn={() => Promise.resolve()}
        suggestedNickname="Ada Lovelace"
      />
    )
    // Signed-in confirmation + nickname prompt, no more "Continue with Google"
    expect(screen.getByText(/signed in with google/i)).toBeInTheDocument()
    expect(screen.getByText(/keep it or pick your own/i)).toBeInTheDocument()
    expect(screen.getByText('next')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
  })

  it('shows the "or" divider before signing in', () => {
    render(<UserSetup onSetup={() => {}} onGoogleSignIn={() => Promise.resolve()} />)
    expect(screen.getByText('or')).toBeInTheDocument()
    expect(screen.queryByText('next')).not.toBeInTheDocument()
  })

  it('pre-fills nickname when suggestedNickname arrives after mount', async () => {
    const { rerender } = render(
      <UserSetup
        onSetup={() => {}}
        onGoogleSignIn={() => Promise.resolve()}
        suggestedNickname=""
      />
    )
    expect(screen.getByLabelText(/nickname/i)).toHaveValue('')
    rerender(
      <MemoryRouter>
        <UserSetup
          onSetup={() => {}}
          onGoogleSignIn={() => Promise.resolve()}
          suggestedNickname="Ada Lovelace"
        />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText(/nickname/i)).toHaveValue('Ada Lovelace')
    })
  })

  it('enables Start Reading when suggestedNickname is provided', () => {
    render(
      <UserSetup
        onSetup={() => {}}
        onGoogleSignIn={() => Promise.resolve()}
        suggestedNickname="Ada Lovelace"
      />
    )
    expect(screen.getByRole('button', { name: /start reading/i })).toBeEnabled()
  })

  it('shows an error message when Google sign-in throws', async () => {
    const user = userEvent.setup()
    render(
      <UserSetup
        onSetup={() => {}}
        onGoogleSignIn={() => Promise.reject(new Error('redirect failed'))}
      />
    )
    await user.click(screen.getByRole('button', { name: /continue with google/i }))
    await waitFor(() => {
      expect(screen.getByText(/google sign-in failed/i)).toBeInTheDocument()
    })
  })
})
