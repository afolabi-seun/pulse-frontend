import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ProjectsPage from '../ProjectsPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { ProjectDto, ProjectStatus } from '../../types/api';

let projects: ProjectDto[] = [];
vi.mock('../../api/projects', () => ({
  useProjectList: () => ({ data: projects, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useProjectThroughput: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../api/teams', () => ({ useTeamList: () => ({ data: [] }) }));
vi.mock('../../hooks/useCurrentRole', () => ({
  useCurrentRole: () => ({ isPmo: true, canCreateProject: true, canDeleteProject: true }),
}));

const project = (name: string, status: ProjectStatus = 'active', description: string | null = null): ProjectDto => ({
  id: name, name, code: name.slice(0, 4).toUpperCase(), description, isActive: status === 'active', status,
  createdAt: '2026-09-01T00:00:00Z', ownerTeamId: null, canAccess: true,
});

describe('ProjectsPage', () => {
  it('opens on the active projects, with a count on each status tab and no tab for an empty status', () => {
    projects = [project('Alpha'), project('Beta'), project('Gamma', 'paused')];
    renderWithProviders(<ProjectsPage />);

    expect(screen.getByRole('tab', { name: /Active/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Active/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Paused/ })).toHaveTextContent('1');
    expect(screen.queryByRole('tab', { name: /Archived/ })).not.toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Paused/ }));
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('pages a long list at 12 projects', () => {
    projects = Array.from({ length: 15 }, (_, i) => project(`Project ${String(i).padStart(2, '0')}`));
    renderWithProviders(<ProjectsPage />);

    expect(screen.getByText('Project 11')).toBeInTheDocument();
    expect(screen.queryByText('Project 12')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Project 12')).toBeInTheDocument();
    expect(screen.queryByText('Project 00')).not.toBeInTheDocument();
  });

  it('searches across every status, not just the open tab', () => {
    projects = [project('Alpha'), project('Mothballed', 'archived', 'old legacy system')];
    renderWithProviders(<ProjectsPage />);

    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'legacy' } });
    expect(screen.getByText('Mothballed')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('opens on whichever status has projects when none are active', () => {
    projects = [project('Old one', 'archived')];
    renderWithProviders(<ProjectsPage />);

    expect(screen.getByText('Old one')).toBeInTheDocument();
  });

  it('says so when a search matches nothing', () => {
    projects = [project('Alpha')];
    renderWithProviders(<ProjectsPage />);

    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'zzz' } });
    expect(screen.getByText('No projects match')).toBeInTheDocument();
  });
});
