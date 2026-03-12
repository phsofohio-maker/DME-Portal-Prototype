/**
 * test/smoke/AdminInbox.test.tsx — Admin Inbox smoke tests (Block 7).
 *
 * Verifies:
 *   - Renders inbox heading
 *   - Shows empty state when no requests
 *   - Renders request rows when data arrives
 *   - Shows pending/RMI count badges
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AdminInbox } from '../../pages/AdminInbox';
import { makeAdmin, makeDMERequest } from '../helpers/factories';

// ─── Mock services ──────────────────────────────────────────────────────────
let requestCallback: ((data: unknown[]) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('../../services/firebaseService', () => ({
  firebaseService: {
    subscribeToAllRequests: vi.fn((cb: (data: unknown[]) => void) => {
      requestCallback = cb;
      return mockUnsubscribe;
    }),
    getAllStaff: vi.fn().mockResolvedValue([]),
    updateRequestStatus: vi.fn().mockResolvedValue(undefined),
    escalateRequest: vi.fn().mockResolvedValue(undefined),
    bulkUpdateRequestStatus: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
  },
}));

vi.mock('../../services/pdfService', () => ({
  exportRequestPDF: vi.fn(),
}));

describe('AdminInbox (smoke)', () => {
  const admin = makeAdmin();

  it('renders the Admin Inbox heading', () => {
    render(<AdminInbox user={admin} />);
    act(() => requestCallback?.([]));

    expect(screen.getByText(/admin.*requests.*inbox/i)).toBeInTheDocument();
  });

  it('shows empty state when no pending requests', () => {
    render(<AdminInbox user={admin} />);
    act(() => requestCallback?.([]));

    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
  });

  it('renders request rows when data arrives', () => {
    render(<AdminInbox user={admin} />);

    const requests = [
      makeDMERequest({ id: 'req-1', patientName: 'Jane Doe', status: 'pending' }),
      makeDMERequest({ id: 'req-2', patientName: 'John Smith', status: 'rmi' }),
    ];
    act(() => requestCallback?.(requests));

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('shows pending and RMI count badges', () => {
    render(<AdminInbox user={admin} />);

    const requests = [
      makeDMERequest({ id: 'r1', status: 'pending' }),
      makeDMERequest({ id: 'r2', status: 'pending' }),
      makeDMERequest({ id: 'r3', status: 'rmi' }),
    ];
    act(() => requestCallback?.(requests));

    // The header shows actionable count badges (e.g. "3 Pending", "1 RMI")
    expect(screen.getByText(/\d+\s*Pending/)).toBeInTheDocument();
    expect(screen.getByText(/\d+\s*RMI/)).toBeInTheDocument();
  });

  it('renders action buttons for each request', () => {
    render(<AdminInbox user={admin} />);

    act(() => requestCallback?.([
      makeDMERequest({ id: 'req-action', status: 'pending' }),
    ]));

    expect(screen.getByText('Process')).toBeInTheDocument();
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = render(<AdminInbox user={admin} />);
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
