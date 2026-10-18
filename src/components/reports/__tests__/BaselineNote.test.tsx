import { screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import BaselineNote from '../BaselineNote';
import { renderWithProviders } from '../../../test/renderWithProviders';

const baseline = vi.hoisted(() => vi.fn());
vi.mock('../../../api/reports', () => ({ useReportingBaseline: () => baseline() }));

describe('BaselineNote', () => {
  it('says where the page starts and that earlier records are kept', () => {
    baseline.mockReturnValue({ data: '2026-10-01' });
    renderWithProviders(<BaselineNote />);

    expect(screen.getByText(/Showing data from .*2026.* onwards\. Earlier records are kept/)).toBeInTheDocument();
  });

  it('says nothing when there is no baseline', () => {
    baseline.mockReturnValue({ data: null });
    const { container } = renderWithProviders(<BaselineNote />);

    expect(container.querySelector('p')).toBeNull();
  });

  it('says nothing while the baseline is still loading', () => {
    baseline.mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<BaselineNote />);

    expect(container.querySelector('p')).toBeNull();
  });
});
