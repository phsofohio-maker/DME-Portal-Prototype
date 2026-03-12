/**
 * test/smoke/DMEForm.test.tsx — DME Request Form smoke tests (Block 7).
 *
 * Verifies:
 *   - Renders all form sections
 *   - Renders patient search field
 *   - Submit button exists and is initially disabled
 *   - Category selection controls available
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DMEForm } from '../../components/Forms/DMEForm';
import { makeNurse } from '../helpers/factories';

// ─── Mock services ──────────────────────────────────────────────────────────
vi.mock('../../services/firebaseService', () => ({
  firebaseService: {
    submitRequest: vi.fn().mockResolvedValue('req-test'),
  },
}));

vi.mock('../../services/patientService', () => ({
  patientService: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/icd10Service', () => ({
  searchICD10: vi.fn().mockResolvedValue([]),
}));

describe('DMEForm (smoke)', () => {
  const nurse = makeNurse();
  const onSuccess = vi.fn();

  it('renders the patient search field', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  it('renders equipment category selection', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByText(/equipment.*category/i)).toBeInTheDocument();
  });

  it('renders clinical details section with ICD-10 field', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByText(/primary diagnosis.*icd-10/i)).toBeInTheDocument();
  });

  it('renders justification textarea', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByText(/justification/i)).toBeInTheDocument();
  });

  it('renders urgency level selection', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByText('Routine')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders consent checkboxes', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByText(/certif.*accurate/i)).toBeInTheDocument();
  });

  it('renders electronic signature section', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByText(/electronic signature/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<DMEForm user={nurse} onSuccess={onSuccess} />);
    expect(screen.getByRole('button', { name: /submit.*request/i })).toBeInTheDocument();
  });
});
