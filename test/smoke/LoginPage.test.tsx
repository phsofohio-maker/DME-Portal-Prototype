/**
 * test/smoke/LoginPage.test.tsx — LoginPage component smoke tests (Block 7).
 *
 * Verifies:
 *   - Renders email and password fields
 *   - Shows error on failed login
 *   - Calls firebaseService.login on submit
 *   - Shows loading state during authentication
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../../pages/LoginPage';

// Mock firebaseService — the setup.ts mock provides a stub, but we need
// a controllable login mock for these tests.
const mockLogin = vi.fn();
vi.mock('../../services/firebaseService', () => ({
  firebaseService: {
    login: (...args: unknown[]) => mockLogin(...args),
  },
}));

describe('LoginPage (smoke)', () => {
  it('renders the email input field', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('renders the password input field', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the Sign In button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the Parrish Health branding', () => {
    render(<LoginPage />);
    expect(screen.getByText('Parrish Health')).toBeInTheDocument();
  });

  it('calls login service on form submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), 'nurse@parrish.health');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('nurse@parrish.health', 'password123');
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('auth/wrong-password'));
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), 'bad@test.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });

  it('disables submit button while loading', async () => {
    // Make login hang so we can check the loading state
    mockLogin.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });
});
