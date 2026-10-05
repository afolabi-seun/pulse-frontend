import { screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CheckInHistoryPage from '../CheckInHistoryPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import * as checkInsApi from '../../api/checkIns';
import type { CheckInDto } from '../../types/api';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ currentUser: { id: 'eng-1', name: 'Alice' } }),
}));
vi.mock('../../api/projects', () => ({
  useMyProjects: () => ({ data: [{ id: 'p1', name: 'OMS' }], isLoading: false }),
}));
vi.mock('../../api/checkIns');

const ci = (over: Partial<CheckInDto>): CheckInDto => ({
  id: Math.random().toString(), engineerId: 'eng-1', date: '2026-10-02', completed: 'Did a thing', plannedNext: 'Do another',
  blockers: null, submittedAt: '', projectId: null, ...over,
});

const ready = (items: CheckInDto[]) =>
  vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({ data: { items, nextCursor: null, hasMore: false }, isLoading: false, error: null } as any);

describe('CheckInHistoryPage', () => {
  beforeEach(() => vi.mocked(checkInsApi.useCheckInHistory).mockReset());

  it('lists check-ins as cards under a heading per day, with the project and a blocker callout', () => {
    ready([
      ci({ id: 'a', date: '2026-10-02', projectId: 'p1', completed: 'Shipped the export', plannedNext: 'Start the import', blockers: 'Need API keys' }),
      ci({ id: 'b', date: '2026-10-02', projectId: null, completed: 'Admin tidy-up', plannedNext: 'More admin' }),
      ci({ id: 'c', date: '2026-10-01', projectId: 'p1', completed: 'Yesterday work', plannedNext: 'Today plan' }),
    ]);
    renderWithProviders(<CheckInHistoryPage />);

    for (const header of ['Completed', 'Planned next'])
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);

    const first = within(screen.getByText('Shipped the export').closest('.rounded-lg') as HTMLElement);
    expect(first.getByText('OMS')).toBeInTheDocument();
    expect(first.getByText('Start the import')).toBeInTheDocument();
    expect(first.getByText('Need API keys')).toBeInTheDocument();
    expect(within(screen.getByText('Admin tidy-up').closest('.rounded-lg') as HTMLElement).getByText('General')).toBeInTheDocument();

    // One heading per day, newest first, with the day's entries under it.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
    const iHeadingNew = headings.findIndex((t) => /2 Oct/.test(t));
    const iHeadingOld = headings.findIndex((t) => /1 Oct/.test(t));
    expect(iHeadingNew).toBeGreaterThan(-1);
    expect(iHeadingOld).toBeGreaterThan(iHeadingNew);
  });

  it('shows an empty state when there are no check-ins', () => {
    ready([]);
    renderWithProviders(<CheckInHistoryPage />);
    expect(screen.getByText('No check-ins yet')).toBeInTheDocument();
  });
});
