import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TeamsPage from '../TeamsPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { EngineerDto, TeamDto } from '../../../types/api';

const team = (over: Partial<TeamDto> = {}): TeamDto => ({
  id: 'team-infra', name: 'Engineering/Infra/DevOps', teamLeadId: 'lead-1', teamLeadName: 'Temitope Obasanmi', isActive: true,
  department: 'Engineering', memberCount: 6, headId: null, headName: null, ...over,
});

const person = (id: string, name: string, role: EngineerDto['role'], isActive = true): EngineerDto => ({
  id, name, email: `${id}@x.io`, role, baselinePoints: 10, baselineCycleDays: 14, isActive, team: null, teamId: null,
  isQa: false, discipline: null, activeTasks: 0,
} as EngineerDto);

const engineers = [
  person('felix', 'Felix Onen', 'head_of_infra_devops'),
  person('seun', 'Oluwaseun Afolabi', 'head_of_rd'),
  person('retired-head', 'Retired Head', 'head_of_design', false),
  person('ada', 'Ada Engineer', 'engineer'),
  person('lead-1', 'Temitope Obasanmi', 'team_lead'),
];

const mocks = vi.hoisted(() => ({ teams: vi.fn(), isPmo: vi.fn(), update: vi.fn() }));
vi.mock('../../../api/teams', () => ({
  useTeamList:   () => mocks.teams(),
  useCreateTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTeam: () => ({ mutate: mocks.update, isPending: false }),
}));
vi.mock('../../../api/engineers', () => ({ useEngineerList: () => ({ data: engineers }) }));
vi.mock('../../../hooks/useCurrentRole', () => ({ useCurrentRole: () => ({ isPmo: mocks.isPmo() }) }));
// A plain <select> stands in for the portal-based picker, so the options and the chosen value can be read directly.
vi.mock('@/components/ui/searchable-select', () => ({
  SearchableSelect: ({ value, onChange, options, placeholder }: {
    value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
  }) => (
    <select aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

function show(teams: TeamDto[], isPmo = true) {
  mocks.teams.mockReturnValue({ data: teams, isLoading: false, error: null, refetch: vi.fn() });
  mocks.isPmo.mockReturnValue(isPmo);
  return renderWithProviders(<TeamsPage />);
}

describe('TeamsPage: the head a team names', () => {
  beforeEach(() => mocks.update.mockClear());

  it('shows the named head on the card', () => {
    show([team({ headId: 'felix', headName: 'Felix Onen' })]);

    expect(screen.getByText('Head: Felix Onen')).toBeInTheDocument();
    expect(screen.queryByText('No head named')).not.toBeInTheDocument();
  });

  it('flags a team with no head named, for people who can manage teams', () => {
    show([team()]);

    expect(screen.getByText('No head named')).toBeInTheDocument();
  });

  it('does not flag it for people who cannot manage teams', () => {
    show([team()], false);

    expect(screen.queryByText('No head named')).not.toBeInTheDocument();
  });

  it('offers only active people with a department-head role', () => {
    show([team()]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const picker = screen.getByLabelText('Search department heads…');
    const options = within(picker).getAllByRole('option').map((o) => o.textContent);

    expect(options).toEqual(['None (use the department label)', 'Felix Onen', 'Oluwaseun Afolabi']);
  });

  it('saves the chosen head', async () => {
    show([team()]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Search department heads…'), { target: { value: 'felix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ headId: 'felix' }), expect.anything());
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('clearHead');
  });

  it('clears the head when "None" is chosen', async () => {
    show([team({ headId: 'seun', headName: 'Oluwaseun Afolabi' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Search department heads…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ clearHead: true });
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('headId');
  });

  it('starts the edit form on the head already named', () => {
    show([team({ headId: 'seun', headName: 'Oluwaseun Afolabi' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Search department heads…')).toHaveValue('seun');
  });
});
