import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Set the env var before importing the component so the module picks it up
const CORRECT_CODE = 'secret123'

describe('AdminLogin', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_ADMIN_CODE', CORRECT_CODE)
    // Re-import fresh each time so the module-level constant reflects the env
    vi.resetModules()
  })

  async function renderAdminLogin(onAuth = vi.fn()) {
    const { default: AdminLogin } = await import('../components/AdminLogin')
    render(<AdminLogin onAuth={onAuth} />)
    return onAuth
  }

  it('renders the admin code input', async () => {
    await renderAdminLogin()
    expect(screen.getByLabelText(/admin code/i)).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty', async () => {
    await renderAdminLogin()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('shows an error message on wrong code', async () => {
    const user = userEvent.setup()
    await renderAdminLogin()
    await user.type(screen.getByLabelText(/admin code/i), 'wrongcode')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/incorrect code/i)).toBeInTheDocument()
  })

  it('error clears when user types again after a failed attempt', async () => {
    const user = userEvent.setup()
    await renderAdminLogin()
    await user.type(screen.getByLabelText(/admin code/i), 'wrongcode')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/incorrect code/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/admin code/i), 'x')
    expect(screen.queryByText(/incorrect code/i)).not.toBeInTheDocument()
  })

  it('calls onAuth when the correct code is submitted', async () => {
    const user = userEvent.setup()
    const onAuth = await renderAdminLogin()
    await user.type(screen.getByLabelText(/admin code/i), CORRECT_CODE)
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(onAuth).toHaveBeenCalledOnce()
  })

  it('does not call onAuth when wrong code is submitted', async () => {
    const user = userEvent.setup()
    const onAuth = await renderAdminLogin()
    await user.type(screen.getByLabelText(/admin code/i), 'notright')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(onAuth).not.toHaveBeenCalled()
  })
})
