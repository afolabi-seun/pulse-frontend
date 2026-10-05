import { screen, within, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import StandupSummaryPage from '../StandupSummaryPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import * as checkInsApi from '../../../api/checkIns';
import type { StandupEntryDto, StandupSummaryDto } from '../../../types/api';

vi.mock('../../../api/checkIns');
vi.mock('../../../api/teams', () => ({ useTeamList: () => ({ data: [] }) }));
vi.mock('../../../api/tasks', () => ({ useTaskList: () => ({ data: { items: [] }, isLoading: false }) }));
vi.mock('../../../api/engineers', () => ({ useEngineer: () => ({ data: undefined }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ currentUser: { id: 'u1', name: 'Nina' } }) }));
vi.mock('../../../hooks/useCurrentRole', () => ({
  useCurrentRole: () => ({ isPmo: true, isHeadOfProduct: false, isTeamLead: false }),
}));

const entry = (over: Partial<StandupEntryDto>): StandupEntryDto => ({
  engineerId: 'e', engineerName: 'Emma Wilson', role: 'engineer', teamName: 'Platform', completed: 'Did work', plannedNext: 'More work',
  blockers: null, projectId: null, projectName: null, ...over,
});

const ready = (summary: Partial<StandupSummaryDto>) =>
  vi.mocked(checkInsApi.useStandupSummary).mockReturnValue({
    data: { date: '2026-10-02', teamId: null, entries: [], missingEngineers: [], ...summary }, isLoading: false,
  } as any);

describe('StandupSummaryPage', () => {
  // The shared Table's scroll-shadow measures itself with a ResizeObserver, which jsdom lacks.
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(checkInsApi.useStandupSummary).mockReset();
    vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({ data: { items: [] }, isLoading: false } as any);
  });

  it('shows each check-in as a table row: engineer with role and project, completed, planned next and blocker', () => {
    ready({
      entries: [
        entry({ engineerId: 'e1', engineerName: 'Emma Wilson', role: 'head_of_rd', projectName: 'OMS', completed: 'Shipped the export', plannedNext: 'Start the import', blockers: 'Need API keys' }),
        entry({ engineerId: 'e2', engineerName: 'Frank Okafor', completed: 'Reviews', plannedNext: 'Pairing' }),
      ],
    });
    renderWithProviders(<StandupSummaryPage />);

    for (const header of ['Engineer', 'Completed', 'Planned next', 'Blocker'])
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    const emma = within(screen.getByRole('row', { name: /Emma Wilson/ }));
    expect(emma.getByText('Head Of Rd')).toBeInTheDocument();
    expect(emma.getByText('OMS')).toBeInTheDocument();
    expect(emma.getByText('Shipped the export')).toBeInTheDocument();
    expect(emma.getByText('Start the import')).toBeInTheDocument();
    expect(emma.getByText('Need API keys')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Frank Okafor/ })).getByText('—')).toBeInTheDocument();
  });

  it('summarises in one compact strip instead of tiles and a repeated blockers callout', () => {
    ready({
      entries: [entry({ engineerId: 'e1', blockers: 'Stuck' }), entry({ engineerId: 'e2', engineerName: 'Frank Okafor' })],
      missingEngineers: [{ id: 'm1', name: 'Grace Liu' }],
    });
    renderWithProviders(<StandupSummaryPage />);

    expect(screen.getByText('checked in')).toBeInTheDocument();
    expect(screen.getByText('missing')).toBeInTheDocument();
    expect(screen.getByText('blocker')).toBeInTheDocument();
    // The blocker text appears once, on its row — there is no separate callout repeating it.
    expect(screen.getAllByText('Stuck')).toHaveLength(1);
  });

  it('can narrow the digest to just the check-ins with blockers', () => {
    ready({
      entries: [
        entry({ engineerId: 'e1', engineerName: 'Emma Wilson', blockers: 'Stuck' }),
        entry({ engineerId: 'e2', engineerName: 'Frank Okafor' }),
      ],
      missingEngineers: [{ id: 'm1', name: 'Grace Liu' }],
    });
    renderWithProviders(<StandupSummaryPage />);

    fireEvent.click(screen.getByRole('checkbox', { name: /show only blockers/i }));

    expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    expect(screen.queryByText('Frank Okafor')).not.toBeInTheDocument();
    expect(screen.queryByText('Grace Liu')).not.toBeInTheDocument();
  });

  it('offers no blockers filter when nobody has one', () => {
    ready({ entries: [entry({ engineerId: 'e1' })] });
    renderWithProviders(<StandupSummaryPage />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('groups by team with a heading and count when there are several teams, and lists who is missing', () => {
    ready({
      entries: [
        entry({ engineerId: 'e1', engineerName: 'Emma Wilson', teamName: 'Platform' }),
        entry({ engineerId: 'e2', engineerName: 'Frank Okafor', teamName: 'Core Banking' }),
      ],
      missingEngineers: [{ id: 'm1', name: 'Grace Liu' }],
    });
    renderWithProviders(<StandupSummaryPage />);

    expect(screen.getByRole('heading', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Core Banking' })).toBeInTheDocument();
    expect(screen.getByText('Missing (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grace Liu/ })).toBeInTheDocument();
  });

  it('says so when no check-ins were submitted', () => {
    ready({});
    renderWithProviders(<StandupSummaryPage />);
    expect(screen.getByText(/no check-ins submitted for this date/i)).toBeInTheDocument();
  });

  describe('teams', () => {
    const twoTeams = () => ready({
      entries: [
        entry({ engineerId: 'e1', engineerName: 'Emma Wilson', teamName: 'Platform', blockers: 'Waiting on keys' }),
        entry({ engineerId: 'e2', engineerName: 'Frank Okafor', teamName: 'Design' }),
      ],
    });

    it('folds a team away, says how many blockers it is hiding, and remembers it', () => {
      twoTeams();
      const { unmount } = renderWithProviders(<StandupSummaryPage />);

      const platform = screen.getByRole('button', { name: 'Platform, 1 check-in' });
      expect(platform).toHaveAttribute('aria-expanded', 'true');
      expect(within(platform).getByText('1 blocker')).toBeInTheDocument();

      fireEvent.click(platform);
      expect(screen.queryByText('Emma Wilson')).not.toBeInTheDocument();
      expect(screen.getByText('Frank Okafor')).toBeInTheDocument();
      // Folded, the team still shows its blocker, so folding can't hide one.
      expect(within(screen.getByRole('button', { name: 'Platform, 1 check-in' })).getByText('1 blocker')).toBeInTheDocument();

      unmount();
      renderWithProviders(<StandupSummaryPage />);
      expect(screen.queryByText('Emma Wilson')).not.toBeInTheDocument();
    });

    it('folds and unfolds every team at once', () => {
      twoTeams();
      renderWithProviders(<StandupSummaryPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Fold all' }));
      expect(screen.queryByText('Emma Wilson')).not.toBeInTheDocument();
      expect(screen.queryByText('Frank Okafor')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Unfold all' }));
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
      expect(screen.getByText('Frank Okafor')).toBeInTheDocument();
    });

    const many = (n: number, over: (i: number) => Partial<StandupEntryDto> = () => ({})) =>
      Array.from({ length: n }, (_, i) => entry({ engineerId: `e${i}`, engineerName: `Person ${String(i).padStart(2, '0')}`, ...over(i) }));

    it('pages a long digest at 25 check-ins, and says which ones it is showing', () => {
      ready({ entries: many(30) });
      renderWithProviders(<StandupSummaryPage />);

      expect(screen.getAllByRole('row').length).toBe(26); // header + 25
      expect(screen.getByText('Showing 1–25 of 30 check-ins')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getAllByRole('row').length).toBe(6); // header + 5
      expect(screen.getByText('Showing 26–30 of 30 check-ins')).toBeInTheDocument();
      expect(screen.getByText('Person 29')).toBeInTheDocument();
      expect(screen.queryByText('Person 00')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('shows no pager when everything fits on one page', () => {
      ready({ entries: many(10) });
      renderWithProviders(<StandupSummaryPage />);

      expect(screen.queryByText(/check-ins$/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });

    it('carries a team across a page break, under its own header on the next page', () => {
      ready({ entries: many(30, (i) => ({ teamName: i < 20 ? 'Platform' : 'Design' })) });
      renderWithProviders(<StandupSummaryPage />);

      expect(screen.getByRole('button', { name: 'Design, 10 check-ins' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      // Page 2 holds the last 5 of Design only, so Platform has no rows or header here.
      expect(screen.getByRole('button', { name: 'Design, 10 check-ins' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Platform/ })).not.toBeInTheDocument();
    });

    it('warns when a blocker is on another page, and jumps to the blockers', () => {
      ready({ entries: many(30, (i) => (i === 28 ? { blockers: 'Waiting on keys' } : {})) });
      renderWithProviders(<StandupSummaryPage />);

      expect(screen.getByText('1 blocker on other pages.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Show only blockers' }));
      expect(screen.getByText('Waiting on keys')).toBeInTheDocument();
      expect(screen.queryByText(/on other pages/)).not.toBeInTheDocument();
    });

    it('does not warn when every blocker is on the page being shown', () => {
      ready({ entries: many(30, (i) => (i === 2 ? { blockers: 'Stuck' } : {})) });
      renderWithProviders(<StandupSummaryPage />);

      expect(screen.queryByText(/on other pages/)).not.toBeInTheDocument();
    });
  });
});
