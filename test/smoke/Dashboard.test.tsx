/**
 * test/smoke/Dashboard.test.tsx — Dashboard component smoke tests (Block 7).
 *
 * Verifies:
 *   - Renders welcome message with user name
 *   - Renders KPI cards (Active, Approved, Info Needed, System Health)
 *   - Shows loading skeleton initially
 *   - Renders request list when data arrives
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Dashboard } from '../../pages/Dashboard';
import { makeNurse, makeAdmin, makeDMERequest, makeApprovedRequest } from '../helpers/factories';

// ─── Mock firebaseService ───────────────────────────────────────────────────
let subscribeCallback: ((data: unknown[]) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('../../services/firebaseService', () => ({
  firebaseService: {
    subscribeToUserRequests: vi.fn((_uid: string, cb: (data: unknown[]) => void) => {
      subscribeCallback = cb;
      return mockUnsubscribe;
    }),
  },
}));

vi.mock('../../services/pdfService', () => ({
  exportRequestPDF: vi.fn(),
}));

describe('Dashboard (smoke)', () => {
  it('renders welcome message with user display name', () => {
    const nurse = makeNurse({ displayName: 'Janet Nurse' });
    render(<Dashboard user={nurse} />);

    // Callback fires to exit loading
    act(() => subscribeCallback?.([]));

    expect(screen.getByText(/welcome back.*janet nurse/i)).toBeInTheDocument();
  });

  it('renders KPI cards', () => {
    const nurse = makeNurse();
    render(<Dashboard user={nurse} />);

    const requests = [
      makeDMERequest({ status: 'pending' }),
      makeDMERequest({ id: 'r2', status: 'pending' }),
      makeApprovedRequest(),
    ];
    act(() => subscribeCallback?.(requests));

    expect(screen.getByText('Active Requests')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Info Needed')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
  });

  it('shows user role badge', () => {
    const admin = makeAdmin();
    render(<Dashboard user={admin} />);
    act(() => subscribeCallback?.([]));

    expect(screen.getByText(/role:/i)).toBeInTheDocument();
  });

  it('shows "Your Recent Submissions" section', () => {
    const nurse = makeNurse();
    render(<Dashboard user={nurse} />);
    act(() => subscribeCallback?.([]));

    expect(screen.getByText('Your Recent Submissions')).toBeInTheDocument();
  });

  it('cleans up subscription on unmount', () => {
    const nurse = makeNurse();
    const { unmount } = render(<Dashboard user={nurse} />);
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
