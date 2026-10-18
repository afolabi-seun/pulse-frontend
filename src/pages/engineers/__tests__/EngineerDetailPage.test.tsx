import { screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import EngineerDetailPage from '../EngineerDetailPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { EngineerDto, TaskDto, TeamDto } from '../../../types/api';

const mocks = vi.hoisted(() => ({ tasks: vi.fn(), activity: vi.fn() }));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ allow: () => true }) }));
vi.mock('../../../api/engineers', () => ({
  useEngineer: () => ({
    data: { id: 'eng-1', name: 'Ada Engineer', email: 'ada@x.io', role: 'engineer', baselinePoints: 10, baselineCycleDays: 14, isActive: true,
      team: 'Infra', teamId: 'team-1', isQa: false, discipline: null, activeTasks: 0 } satisfies Partial<EngineerDto>,
    isLoading: false, error: null, refetch: vi.fn(),
  }),
  useUpdateEngineer: () => ({ mutate: vi.fn(), isPending: false }),
  useEngineerSignals: () => ({ data: undefined }),
  useEngineerOverrides: () => ({ data: [] }),
  useCreateOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useBaselineHistory: () => ({ data: [] }),
  useEngineerThroughput: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../../api/teams', () => ({
  useTeamList: () => ({
    data: [{ id: 'team-1', name: 'Engineering/Infra/DevOps', teamLeadName: 'Temitope Obasanmi', headName: 'Felix Onen', isActive: true,
      department: 'Engineering', memberCount: 6, teamLeadId: 'l', headId: 'h' } satisfies Partial<TeamDto>],
  }),
}));
vi.mock('../../../api/tasks', () => ({ useTaskList: () => mocks.tasks() }));
vi.mock('../../../api/timeEntries', () => ({ useEngineerTimeActivity: (...args: unknown[]) => mocks.activity(...args) }));
vi.mock('react-chartjs-2', () => ({ Chart: () => <div data-testid="chart" /> }));
vi.mock('../../../components/tasks/TaskPreviewDrawer', () => ({ default: () => null }));

const task = (over: Partial<TaskDto>): TaskDto => ({
  id: 't', title: 'A task', taskKey: 'APP-1', status: 'active', points: 3, dueDate: null, actualEndDate: null, sentToQaAt: null,
  projectName: 'Mobile App', pausedAt: null, ...over,
} as TaskDto);

function show(items: TaskDto[]) {
  mocks.tasks.mockReturnValue({ data: { items, hasMore: false, nextCursor: null }, isLoading: false });
  return renderWithProviders(
    <Routes><Route path="/engineers/:id" element={<EngineerDetailPage />} /></Routes>,
    { initialEntries: ['/engineers/eng-1'] },
  );
}

describe('EngineerDetailPage', () => {
  beforeEach(() => {
    mocks.activity.mockReturnValue({ data: undefined, isError: false });
  });

  it('shows the team lead and the named department head next to the team', () => {
    show([]);

    expect(screen.getByText('Engineering/Infra/DevOps')).toBeInTheDocument();
    expect(screen.getByText(/Lead: Temitope Obasanmi/)).toBeInTheDocument();
    expect(screen.getByText(/Head: Felix Onen/)).toBeInTheDocument();
  });

  it('splits work that counts toward workload from work that does not, and says why', () => {
    show([
      task({ id: 'a', title: 'Live work', status: 'active' }),
      task({ id: 'b', title: 'Stuck work', status: 'blocked' }),
      task({ id: 'c', title: 'Held work', status: 'paused' }),
      task({ id: 'd', title: 'With QA', status: 'inQa' }),
      task({ id: 'e', title: 'Not started', status: 'backlog' }),
    ]);

    expect(screen.getByText('Counts toward workload')).toBeInTheDocument();
    const notCounted = screen.getByText(/Not counted in workload/).nextElementSibling as HTMLElement;
    expect(within(notCounted).getByText(/Held work/)).toBeInTheDocument();
    expect(within(notCounted).getByText(/With QA/)).toBeInTheDocument();
    expect(within(notCounted).getByText(/Not started/)).toBeInTheDocument();
    expect(within(notCounted).queryByText(/Live work/)).not.toBeInTheDocument();
    expect(within(notCounted).queryByText(/Stuck work/)).not.toBeInTheDocument();
  });

  it('shows no group headings when everything counts', () => {
    show([task({ id: 'a', title: 'Live work', status: 'active' })]);

    expect(screen.queryByText('Counts toward workload')).not.toBeInTheDocument();
    expect(screen.queryByText(/Not counted in workload/)).not.toBeInTheDocument();
  });

  it('says how many working days a task has been paused', () => {
    // A Monday and the Monday a week later are five working days apart, whatever today is: use a date far enough back to be certain of "more than 5".
    show([task({ id: 'c', title: 'Held work', status: 'paused', pausedAt: '2020-01-06T10:00:00Z' })]);

    expect(screen.getByText(/paused \d{3,} working days/)).toBeInTheDocument();
  });

  it('flags a Backlog task with no estimate', () => {
    show([task({ id: 'e', title: 'Not started', status: 'backlog', points: 0 })]);

    expect(screen.getByText(/needs an estimate before time can be logged/)).toBeInTheDocument();
  });

  it('does not flag an estimated Backlog task', () => {
    show([task({ id: 'e', title: 'Groomed', status: 'backlog', points: 5 })]);

    expect(screen.queryByText(/needs an estimate/)).not.toBeInTheDocument();
  });

  it('shows hours logged this week and last, added without rounding noise', () => {
    mocks.activity.mockReturnValue({
      data: {
        assigned: [{ hours: 0.93 }, { hours: 2.49 }], loggedOnly: [], otherTime: [{ hours: 1 }], assignedWithoutTime: 0,
      },
      isError: false,
    });
    show([]);

    expect(screen.getAllByText('4.42h')).toHaveLength(2);
    expect(screen.queryByText(/4\.4200000/)).not.toBeInTheDocument();
  });

  it('leaves the time card out when the viewer cannot see time data', () => {
    mocks.activity.mockReturnValue({ data: undefined, isError: true });
    show([]);

    expect(screen.queryByText('Time logged')).not.toBeInTheDocument();
  });
});
