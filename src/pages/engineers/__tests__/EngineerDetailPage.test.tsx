import { screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import EngineerDetailPage from '../EngineerDetailPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { EngineerDto, TeamDto } from '../../../types/api';

const mocks = vi.hoisted(() => ({ activity: vi.fn() }));

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
vi.mock('../../../components/engineers/EngineerTasksCard', () => ({ default: () => <div data-testid="tasks-card" /> }));
vi.mock('../../../api/timeEntries', () => ({ useEngineerTimeActivity: (...args: unknown[]) => mocks.activity(...args) }));
vi.mock('react-chartjs-2', () => ({ Chart: () => <div data-testid="chart" /> }));
vi.mock('../../../components/tasks/TaskPreviewDrawer', () => ({ default: () => null }));

function show() {
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
    show();

    expect(screen.getByText('Engineering/Infra/DevOps')).toBeInTheDocument();
    expect(screen.getByText(/Lead: Temitope Obasanmi/)).toBeInTheDocument();
    expect(screen.getByText(/Head: Felix Onen/)).toBeInTheDocument();
  });

  it('shows hours logged this week and last, added without rounding noise', () => {
    mocks.activity.mockReturnValue({
      data: {
        assigned: [{ hours: 0.93 }, { hours: 2.49 }], loggedOnly: [], otherTime: [{ hours: 1 }], assignedWithoutTime: 0,
      },
      isError: false,
    });
    show();

    expect(screen.getAllByText('4.42h')).toHaveLength(2);
    expect(screen.queryByText(/4\.4200000/)).not.toBeInTheDocument();
  });

  it('leaves the time card out when the viewer cannot see time data', () => {
    mocks.activity.mockReturnValue({ data: undefined, isError: true });
    show();

    expect(screen.queryByText('Time logged')).not.toBeInTheDocument();
  });
});
