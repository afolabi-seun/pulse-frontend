import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DashboardPage from '../DashboardPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import * as checkInsApi from '../../api/checkIns';
import * as tasksApi from '../../api/tasks';
import { todayIso } from '../../lib/dates';

const mockUseAuth = vi.fn(() => ({
  currentUser: { id: 'eng-1', name: 'Alice Smith', role: 'engineer', permissions: [], capabilities: [] },
  allow: vi.fn().mockReturnValue(false),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

vi.mock('../../api/projects', () => ({
  useFollowedProjects: () => ({ data: [], isLoading: false }),
  useMyProjects:       () => ({ data: [], isLoading: false }),
}));

const mockPmoReport = vi.hoisted(() => vi.fn());
vi.mock('../../api/reports', () => ({
  usePmoReport: () => mockPmoReport(),
  useOrgTrend:  () => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../api/sprints', () => ({
  useSprintList: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../api/escalations', () => ({
  useEscalations: () => ({ data: undefined }),
}));

const mockSignals = vi.hoisted(() => vi.fn());
vi.mock('../../api/engineers', () => ({
  useEngineer:        () => ({ data: { baselinePoints: 20, name: 'Alice Smith' } }),
  useEngineerSignals: () => mockSignals(),
  useEngineerList:    () => ({ data: undefined }),
}));

vi.mock('../../api/checkIns');

vi.mock('../../api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/tasks')>();
  return {
    ...actual,
    // Backs the "My tasks" widget, which still pages via useTaskList directly.
    useTaskList: vi.fn(() => ({
      data: {
        items: [
          { id: 't1', title: 'Build login page', points: 5, status: 'active',  dueDate: '2026-07-01' },
          { id: 't2', title: 'Fix nav bug',       points: 3, status: 'blocked', dueDate: '2026-06-20' },
        ],
      },
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
    })),
    // Backs the workload/blocked stats, which page through everything via useAllTasks (see
    // DashboardPage's own comment) instead of a single capped useTaskList fetch.
    useAllTasks: vi.fn(() => ({
      items: [
        { id: 't1', title: 'Build login page', points: 5, status: 'active',  dueDate: '2026-07-01' },
        { id: 't2', title: 'Fix nav bug',       points: 3, status: 'blocked', dueDate: '2026-06-20' },
      ],
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
      truncated: false,
    })),
  };
});

const emptyHistory = () => {
  vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({ data: { items: [], nextCursor: null, hasMore: false }, isLoading: false } as any);
  vi.mocked(checkInsApi.useStandupSummary).mockReturnValue({ data: undefined, isLoading: false } as any);
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockSignals.mockReturnValue({ data: null });
    mockPmoReport.mockReturnValue({ data: undefined, isLoading: false });
    emptyHistory();
    localStorage.clear();
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'eng-1', name: 'Alice Smith', role: 'engineer', permissions: [], capabilities: [] },
      allow: vi.fn().mockReturnValue(false),
    });
  });

  it('renders workload bar and task list', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/workload capacity/i)).toBeInTheDocument();
    expect(screen.getByText('Build login page')).toBeInTheDocument();
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
  });

  it('excludes InQa and Paused tasks from the workload points total', () => {
    // Workload here must match TaskStatusExtensions.CountsAsActiveWorkload on the backend
    // (Active + Blocked only) — an InQa or Paused task still counts toward "Active Tasks" but
    // must not inflate the points/capacity numbers, or an engineer's own dashboard diverges from
    // the server-computed total their team lead sees on the Engineers roster.
    vi.mocked(tasksApi.useAllTasks).mockReturnValueOnce({
      items: [
        { id: 't1', title: 'Build login page', points: 5, status: 'active',  dueDate: '2026-07-01' },
        { id: 't2', title: 'Fix nav bug',       points: 3, status: 'blocked', dueDate: '2026-06-20' },
        { id: 't3', title: 'In review',         points: 7, status: 'inQa',    dueDate: '2026-06-25' },
        { id: 't4', title: 'On hold',           points: 4, status: 'paused',  dueDate: '2026-06-28' },
      ],
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
      truncated: false,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('4')).toBeInTheDocument(); // Active Tasks count includes all 4
    expect(screen.getByText('8 pts total')).toBeInTheDocument(); // but points only sum active+blocked (5+3)
    expect(screen.getByText('8 / 20 pts')).toBeInTheDocument();
  });

  it('reveals completed tasks in My tasks only after toggling "Show completed"', () => {
    // Finishing a task removes it from this list by default — the toggle is the escape hatch
    // back to "show me what I just did" instead of it looking like the task vanished.
    vi.mocked(tasksApi.useTaskList).mockImplementation((params: any) => ({
      data: {
        items: params.excludeDone
          ? [{ id: 't1', title: 'Build login page', points: 5, status: 'active', dueDate: '2026-07-01' }]
          : [
              { id: 't1', title: 'Build login page', points: 5, status: 'active', dueDate: '2026-07-01' },
              { id: 't2', title: 'Ship the changelog', points: 2, status: 'done', dueDate: '2026-06-20', actualEndDate: '2026-06-19' },
            ],
      },
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
    }) as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.queryByText('Ship the changelog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show completed'));

    expect(screen.getByText('Ship the changelog')).toBeInTheDocument();
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it('shows check-in nudge when not checked in today', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/you haven't submitted your check-in today/i)).toBeInTheDocument();
  });

  it('hides check-in nudge when already checked in today', () => {
    const today = todayIso();
    vi.mocked(checkInsApi.useCheckInHistory).mockReturnValueOnce({
      data: { items: [{ id: 'ci1', engineerId: 'eng-1', date: today, completed: '', plannedNext: '', blockers: null, createdAt: '' }], nextCursor: null, hasMore: false },
      isLoading: false,
    } as any);

    renderWithProviders(<DashboardPage />);
    expect(screen.queryByText(/you haven't submitted your check-in today/i)).not.toBeInTheDocument();
  });

  it('shows the Organization overview for a ProjectManager, a global-access role with no department', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'pm-1', name: 'Priya PM', role: 'project_manager', permissions: [], capabilities: [] },
      allow: vi.fn().mockReturnValue(false),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
  });

  it('shows the Organization overview for an Accountant — read-only, org-wide, same as Executive/HR', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'acct-1', name: 'Amara Brooks', role: 'accountant', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'accountant-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
  });

  it('shows the org-wide average cycle time, to one decimal place', () => {
    mockPmoReport.mockReturnValue({ data: { ...orgReport, avgCycleTimeDays: 3.456 }, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'ex-1', name: 'Olivia Exec', role: 'executive', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'executive-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('3.5')).toBeInTheDocument();
    expect(screen.getByText('created to done')).toBeInTheDocument();
    expect(screen.getByText('days')).toBeInTheDocument();
  });

  it('shows a dash for cycle time instead of 0 when nothing has completed yet', () => {
    mockPmoReport.mockReturnValue({ data: { ...orgReport, avgCycleTimeDays: null }, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'ex-1', name: 'Olivia Exec', role: 'executive', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'executive-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('Nothing completed yet')).toBeInTheDocument();
  });

  it('shows the org-wide average PR approval time, to one decimal place', () => {
    mockPmoReport.mockReturnValue({ data: { ...orgReport, avgPrApprovalHours: 4.25 }, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'ex-1', name: 'Olivia Exec', role: 'executive', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'executive-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('request to approval')).toBeInTheDocument();
    expect(screen.getByText('hrs')).toBeInTheDocument();
  });

  it('shows a dash for PR approval time instead of 0 when nothing has been approved yet', () => {
    mockPmoReport.mockReturnValue({ data: { ...orgReport, avgPrApprovalHours: null }, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'ex-1', name: 'Olivia Exec', role: 'executive', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'executive-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('None approved yet')).toBeInTheDocument();
  });

  it('starts Followed projects collapsed for a ProjectManager, so it doesn\'t compete with Organization', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'pm-1', name: 'Priya PM', role: 'project_manager', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'project-follow'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Followed projects')).toBeInTheDocument();
    expect(screen.queryByText(/no followed projects/i)).not.toBeInTheDocument();
  });

  it('leaves Followed projects expanded by default for a Team Lead', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'tl-1', name: 'Tomi TeamLead', role: 'team_lead', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'project-follow'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/no followed projects/i)).toBeInTheDocument();
  });

  const orgReport = {
    projects: [
      { projectId: 'p1', name: 'CIB', health: 'AtRisk', activeSprintName: 'Sprint 14', highPriorityOpenTasks: 0 },
      { projectId: 'p2', name: 'Healthy One', health: 'Healthy', activeSprintName: null, highPriorityOpenTasks: 0 },
    ],
    teams: [],
    blockerAging: [
      { taskId: 'b1', title: 'Gateway timeout', daysBlocked: 6, assigneeName: 'Grace Liu', projectName: 'CIB' },
    ],
  };

  it('names the at-risk projects and oldest blockers on the Executive dashboard', () => {
    mockPmoReport.mockReturnValue({ data: orgReport, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'ex-1', name: 'Olivia Exec', role: 'executive', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'executive-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole('link', { name: /CIB.*At Risk/ })).toHaveAttribute('href', '/projects/p1');
    expect(screen.queryByText('Healthy One')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gateway timeout/ })).toHaveAttribute('href', '/tasks/b1');
  });

  it('keeps the HR dashboard to the summary view, without the project and blocker lists', () => {
    mockPmoReport.mockReturnValue({ data: orgReport, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentUser: { id: 'hr-1', name: 'Hannah HR', role: 'hr', permissions: [], capabilities: [] },
      allow: vi.fn((capability: string) => capability === 'hr-read'),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.queryByText('Longest-aging blockers')).not.toBeInTheDocument();
  });

  // Pinned explicitly: earlier tests in this file leave their own task mock behind.
  const withEightActivePoints = () =>
    vi.mocked(tasksApi.useAllTasks).mockImplementation(() => ({
      items: [
        { id: 't1', title: 'Build login page', points: 5, status: 'active',  dueDate: '2026-07-01' },
        { id: 't2', title: 'Fix nav bug',       points: 3, status: 'blocked', dueDate: '2026-06-20' },
      ],
      isLoading: false, error: null, refetch: vi.fn(), truncated: false,
    }) as any);

  it('shows the load the overwork signal judges beside the total, and flags it', () => {
    withEightActivePoints();
    // Baseline 20; the mocked tasks hold 5 active + 3 blocked = 8 pts. The signal says 17 of it is due this cycle.
    mockSignals.mockReturnValue({
      data: {
        loadVsBaseline: { tripped: true, reason: 'x' }, concurrent: { tripped: false, reason: 'y' },
        staleInProgress: { tripped: false, reason: 'z' }, isOverworked: true, hasActiveOverride: false,
        workload: { activePoints: 8, cyclePoints: 17, cycleDays: 7, thresholdPoints: 26 },
      },
    });

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('8 active · 17 due this cycle / 20 pts')).toBeInTheDocument();
    expect(screen.getByText('17 due this cycle of 20 pts · 8 active in total')).toBeInTheDocument();
    expect(screen.getAllByText('85%').length).toBeGreaterThan(0);   // 17 / 20, not 8 / 20
  });

  it('falls back to the plain total when the signal has no workload figures', () => {
    withEightActivePoints();
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('8 / 20 pts')).toBeInTheDocument();
    expect(screen.queryByText(/due this cycle/)).not.toBeInTheDocument();
  });
});
