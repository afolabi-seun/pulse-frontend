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

  it('says a task list hides finished tasks from before the date, rather than describing report data', () => {
    baseline.mockReturnValue({ data: '2026-10-01' });
    renderWithProviders(<BaselineNote about="tasks" />);

    expect(screen.getByText(/Finished tasks completed before .*2026.* are hidden/)).toBeInTheDocument();
    expect(screen.queryByText(/Showing data from/)).not.toBeInTheDocument();
  });

  it('says nothing about hidden tasks when there is no baseline', () => {
    baseline.mockReturnValue({ data: null });
    const { container } = renderWithProviders(<BaselineNote about="tasks" />);

    expect(container.querySelector('p')).toBeNull();
  });
});
