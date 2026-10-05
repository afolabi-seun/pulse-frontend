import { screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PerformancePage from '../PerformancePage';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { PerformanceMetricsDto } from '../../types/api';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    currentUser: { id: 'me', name: 'Pat PM', role: 'projectManager', permissions: [], capabilities: [] },
    // A project manager sees every section and may pick any team.
    allow: (cap: string) => ['team-lead-or-above', 'pm-or-above'].includes(cap),
  }),
}));

// Chart.js needs a canvas; capture what would have been drawn instead.
const chartProps = vi.hoisted(() => [] as { data: { datasets: { label: string; data: number[] }[] } }[]);
vi.mock('react-chartjs-2', () => ({
  Chart: (props: { data: { datasets: { label: string; data: number[] }[] } }) => {
    chartProps.push(props);
    return <div data-testid="chart" />;
  },
}));

function metrics(over: Partial<PerformanceMetricsDto> = {}): PerformanceMetricsDto {
  return {
    engineerId: 'e1', engineerName: 'Emma Wilson', from: '2026-09-04', to: '2026-10-04',
    deliveredPoints: 18, baselinePoints: 12, baselineCycleDays: 3, expectedPoints: 120, velocityRatio: 0.15,
    tasksCompleted: 4, tasksWithDueDate: 3, tasksCompletedOnTime: 3, onTimeRate: 1,
    avgCycleTimeDays: 2, tasksSentToQa: 2, tasksQaRejected: 0, qaRejectRate: 0,
    escalatedTaskCount: 0, checkInCount: 10, expectedCheckInDays: 21, checkInConsistency: 0.48,
    ...over,
  };
}

const mockMyPerformance = vi.hoisted(() => vi.fn());
const mockTeamPerformance = vi.hoisted(() => vi.fn());
vi.mock('../../api/performance', () => ({
  useMyPerformance:      () => mockMyPerformance(),
  useTeamPerformance:    (...args: unknown[]) => mockTeamPerformance(...args),
  useProjectPerformance: () => ({ data: undefined, isLoading: false, error: null }),
}));

vi.mock('../../api/engineers', () => ({
  useEngineer:           () => ({ data: { id: 'me', teamId: 'team-a' } }),
  useEngineerThroughput: () => ({ data: [{ weekOf: '2026-09-21', pointsDelivered: 10 }, { weekOf: '2026-09-28', pointsDelivered: 18 }], isLoading: false }),
}));

vi.mock('../../api/teams', () => ({
  useTeamList: () => ({
    data: [
      { id: 'team-a', name: 'Alpha', department: 'Core Banking', isActive: true, teamLeadId: null, teamLeadName: null, memberCount: 3 },
      { id: 'team-b', name: 'Beta',  department: 'Payments',     isActive: true, teamLeadId: null, teamLeadName: null, memberCount: 3 },
      { id: 'team-c', name: 'Design Team', department: 'Design', isActive: true, teamLeadId: null, teamLeadName: null, memberCount: 2 },
    ],
  }),
  useTeamThroughput: () => ({ data: [{ weekOf: '2026-09-28', pointsDelivered: 30 }], isLoading: false }),
}));

vi.mock('../../api/projects', () => ({
  useProjectList: () => ({ data: [] }),
}));

function team(count: number): PerformanceMetricsDto[] {
  return Array.from({ length: count }, (_, i) =>
    metrics({ engineerId: `e${i + 1}`, engineerName: `Engineer ${String(i + 1).padStart(2, '0')}`, baselinePoints: 14, baselineCycleDays: 7 }));
}

beforeEach(() => {
  chartProps.length = 0;
  mockMyPerformance.mockReturnValue({ data: metrics(), isLoading: false, error: null });
  mockTeamPerformance.mockReturnValue({ data: team(12), isLoading: false, error: null });
});

describe('PerformancePage — velocity', () => {
  it('measures delivered points against what the baseline expects over the window', () => {
    renderPage();
    const mine = screen.getByText('My performance').closest('section')!;
    expect(within(mine).getByText('15%')).toBeInTheDocument();
    expect(within(mine).getByText('18/120 pts')).toBeInTheDocument();
  });

  it('draws the baseline line as a weekly rate, not the raw per-cycle baseline', () => {
    renderPage();
    // 12 pts per 3 days is 28 pts a week.
    const mine = chartProps.find((c) => c.data.datasets.some((d) => d.label.startsWith('Baseline (28 pts/week)')));
    expect(mine).toBeDefined();
    expect(mine!.data.datasets.find((d) => d.label.startsWith('Baseline'))!.data).toEqual([28, 28]);
  });

  it('sums each engineer\'s weekly baseline for the team chart', () => {
    renderPage();
    // 12 engineers at 14 pts per 7 days is 14 a week each.
    expect(chartProps.some((c) => c.data.datasets.some((d) => d.label === 'Baseline (168 pts/week)'))).toBe(true);
  });
});

describe('PerformancePage — team section', () => {
  it('pages through the engineers, ten at a time', () => {
    renderPage();
    expect(screen.getByText('Showing 1–10 of 12 engineers')).toBeInTheDocument();
    expect(screen.getByText('Engineer 10')).toBeInTheDocument();
    expect(screen.queryByText('Engineer 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByText('Showing 11–12 of 12 engineers')).toBeInTheDocument();
    expect(screen.getByText('Engineer 11')).toBeInTheDocument();
    expect(screen.queryByText('Engineer 01')).not.toBeInTheDocument();
  });

  it('has no pager for a small team', () => {
    mockTeamPerformance.mockReturnValue({ data: team(4), isLoading: false, error: null });
    renderPage();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });

  it('finds a team by typing its department, and loads that team', () => {
    renderPage();
    const picker = screen.getByPlaceholderText('Search teams or departments…');
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: 'pay' } });

    expect(screen.queryByRole('button', { name: 'Alpha · Core Banking' })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Beta · Payments' }));

    expect(mockTeamPerformance).toHaveBeenLastCalledWith('team-b', undefined, 30);
  });

  it('does not repeat a department the team name already carries', () => {
    renderPage();
    fireEvent.focus(screen.getByPlaceholderText('Search teams or departments…'));
    expect(screen.getByRole('button', { name: 'Design Team' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Design Team · Design' })).not.toBeInTheDocument();
  });

  it('goes back to the first page when the team changes', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Showing 11–12 of 12 engineers')).toBeInTheDocument();

    const picker = screen.getByPlaceholderText('Search teams or departments…');
    fireEvent.focus(picker);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Beta · Payments' }));

    expect(screen.getByText('Showing 1–10 of 12 engineers')).toBeInTheDocument();
  });
});

function renderPage() {
  return renderWithProviders(<PerformancePage />);
}
