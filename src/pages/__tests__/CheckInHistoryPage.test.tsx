import { screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
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
  // The shared Table's scroll-shadow measures itself with a ResizeObserver, which jsdom lacks.
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => vi.mocked(checkInsApi.useCheckInHistory).mockReset());

  it('lists check-ins as a table under a heading per day, with the project and a blocker column', () => {
    ready([
      ci({ id: 'a', date: '2026-10-02', projectId: 'p1', completed: 'Shipped the export', plannedNext: 'Start the import', blockers: 'Need API keys' }),
      ci({ id: 'b', date: '2026-10-02', projectId: null, completed: 'Admin tidy-up', plannedNext: 'More admin' }),
      ci({ id: 'c', date: '2026-10-01', projectId: 'p1', completed: 'Yesterday work', plannedNext: 'Today plan' }),
    ]);
    renderWithProviders(<CheckInHistoryPage />);

    for (const header of ['Project', 'Completed', 'Planned next', 'Blocker'])
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();

    const first = within(screen.getByRole('row', { name: /Shipped the export/ }));
    expect(first.getByText('OMS')).toBeInTheDocument();
    expect(first.getByText('Start the import')).toBeInTheDocument();
    expect(first.getByText('Need API keys')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Admin tidy-up/ })).getByText('General')).toBeInTheDocument();

    // One heading row per day, newest first, with the day's entries under it.
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const iHeadingNew = rows.findIndex((t) => /2 Oct/.test(t) && !t.includes('Shipped'));
    const iHeadingOld = rows.findIndex((t) => /1 Oct/.test(t) && !t.includes('Yesterday'));
    expect(iHeadingNew).toBeGreaterThan(-1);
    expect(iHeadingOld).toBeGreaterThan(iHeadingNew);
  });

  it('shows an empty state when there are no check-ins', () => {
    ready([]);
    renderWithProviders(<CheckInHistoryPage />);
    expect(screen.getByText('No check-ins yet')).toBeInTheDocument();
  });
});
