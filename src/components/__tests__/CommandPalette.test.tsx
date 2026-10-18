import { screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CommandPalette from '../CommandPalette';
import { renderWithProviders } from '../../test/renderWithProviders';

const caps = vi.hoisted(() => ({ granted: new Set<string>(), role: 'engineer', engineersMayCreate: false }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ allow: (c: string) => caps.granted.has(c), currentUser: { id: 'u1', role: caps.role } }) }));
vi.mock('../../api/meta', () => ({ useMeta: () => ({ data: { engineersCanCreateTasks: caps.engineersMayCreate } }) }));
vi.mock('../../api/search', () => ({ useSearch: () => ({ data: undefined }) }));

function open(...granted: string[]) {
  caps.granted = new Set(granted);
  caps.role = 'engineer';
  caps.engineersMayCreate = false;
  return renderWithProviders(<CommandPalette open onClose={() => {}} />);
}

describe('CommandPalette: New Task', () => {
  it('is offered to team leads and above', () => {
    open('team-lead-or-above');
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  it('is offered to roles that keep personal to-dos (HR, Accountant)', () => {
    open('personal-task-creator');
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  it('is not offered to engineers and designers, who do not create tasks', () => {
    open();
    expect(screen.queryByText('New Task')).not.toBeInTheDocument();
  });

  it('appears for an engineer once the PMO has allowed engineers to create tasks', () => {
    open();
    caps.engineersMayCreate = true;
    renderWithProviders(<CommandPalette open onClose={() => {}} />);
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  it('does not appear for HR-style roles just because engineers were allowed', () => {
    open();
    caps.role = 'hr';
    caps.engineersMayCreate = true;
    renderWithProviders(<CommandPalette open onClose={() => {}} />);
    expect(screen.queryByText('New Task')).not.toBeInTheDocument();
  });
});
