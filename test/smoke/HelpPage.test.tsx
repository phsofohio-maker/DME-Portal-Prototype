/**
 * test/smoke/HelpPage.test.tsx — Component infrastructure smoke test.
 *
 * Verifies that:
 *   1. React Testing Library renders a component without crashing.
 *   2. jest-dom matchers (toBeInTheDocument, etc.) work correctly.
 *   3. Role-conditional rendering works (admin sees extra FAQ section).
 *
 * HelpPage is chosen because it has no Firebase dependencies, making it a
 * clean infra canary. Full component coverage is in test/unit/ (Block 7).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpPage } from '../../pages/HelpPage';
import { makeAdmin, makeNurse } from '../helpers/factories';

describe('HelpPage (smoke)', () => {
  it('renders the Help Center heading', () => {
    render(<HelpPage user={makeAdmin()} />);
    expect(screen.getByRole('heading', { name: /help center/i })).toBeInTheDocument();
  });

  it('shows the General & Account FAQ section for all roles', () => {
    render(<HelpPage user={makeNurse()} />);
    expect(screen.getByText('General & Account')).toBeInTheDocument();
  });

  it('shows the Secure Messaging FAQ section for all roles', () => {
    render(<HelpPage user={makeNurse()} />);
    expect(screen.getByText('Secure Messaging')).toBeInTheDocument();
  });

  it('shows the Admin Functions section only for admin users', () => {
    const { rerender } = render(<HelpPage user={makeAdmin()} />);
    expect(screen.getByText('Admin Functions')).toBeInTheDocument();

    rerender(<HelpPage user={makeNurse()} />);
    expect(screen.queryByText('Admin Functions')).not.toBeInTheDocument();
  });

  it('shows the contact banner with HIPAA security officer note', () => {
    render(<HelpPage user={makeNurse()} />);
    expect(screen.getByText(/HIPAA Security Officer/i)).toBeInTheDocument();
  });
});
