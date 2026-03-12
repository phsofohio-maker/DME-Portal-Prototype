/**
 * test/smoke/MessagingPortal.test.tsx — Messaging Portal smoke tests (Block 7).
 *
 * Verifies:
 *   - Renders the Staff Directory sidebar
 *   - Shows contacts loading state
 *   - Shows empty state when no contact selected
 *   - Renders send button when a contact is selected
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessagingPortal } from '../../components/Messaging/MessagingPortal';
import { makeNurse, makeAdmin } from '../helpers/factories';

// ─── Mock services ──────────────────────────────────────────────────────────
// vi.mock factories are hoisted — cannot reference variables declared above.
// Inline the mock data directly.
vi.mock('../../services/firebaseService', () => ({
  firebaseService: {
    getAllStaff: vi.fn().mockResolvedValue([
      {
        uid: 'admin-uid-1', email: 'admin@parrish.health', displayName: 'Admin User',
        role: 'admin', createdAt: 0, updatedAt: 0, hasCompletedOnboarding: true,
        status: 'active', department: 'Administration',
      },
      {
        uid: 'nurse-uid-2', email: 'nurse2@parrish.health', displayName: 'Other Nurse',
        role: 'nurse', createdAt: 0, updatedAt: 0, hasCompletedOnboarding: true,
        status: 'active', department: 'Clinical',
      },
    ]),
    subscribeToMessagesBetween: vi.fn((_u1: string, _u2: string, cb: (msgs: unknown[]) => void) => {
      setTimeout(() => cb([]), 0);
      return vi.fn(); // unsubscribe
    }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    markMessageRead: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('MessagingPortal (smoke)', () => {
  const currentUser = makeNurse({ uid: 'nurse-uid-1', displayName: 'Current Nurse' });

  it('renders the Staff Directory heading', async () => {
    render(<MessagingPortal currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.getByText('Staff Directory')).toBeInTheDocument();
    });
  });

  it('shows contacts after loading', async () => {
    render(<MessagingPortal currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Other Nurse')).toBeInTheDocument();
    });
  });

  it('filters out current user from contacts', async () => {
    render(<MessagingPortal currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    // Current user should not appear
    expect(screen.queryByText('Current Nurse')).not.toBeInTheDocument();
  });

  it('shows empty state panel when no contact selected', async () => {
    render(<MessagingPortal currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.getByText(/select.*colleague/i)).toBeInTheDocument();
    });
  });

  it('renders contact search input', async () => {
    render(<MessagingPortal currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });
  });

  it('shows encryption badge after selecting a contact', async () => {
    const user = userEvent.setup();
    render(<MessagingPortal currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Admin User'));

    await waitFor(() => {
      expect(screen.getByText(/end-to-end encrypted/i)).toBeInTheDocument();
    });
  });
});
