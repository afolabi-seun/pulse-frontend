import { screen, within, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import ProjectTimeDetail from '../ProjectTimeDetail';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { ProjectActivityItemDto, ProjectHoursDto, ProjectTimeActivityDto } from '../../../types/api';

const mockQuery = vi.fn();
vi.mock('../../../api/timeEntries', () => ({
  useProjectTimeActivity: (...args: unknown[]) => mockQuery(...args),
}));

const line = (over: Partial<ProjectHoursDto> = {}): ProjectHoursDto =>
  ({ projectId: 'p1', projectName: 'OMS', totalHours: 4, kind: 'project', ...over });

const item = (over: Partial<ProjectActivityItemDto>): ProjectActivityItemDto =>
  ({ date: '2026-10-04', taskId: 't', label: 'A task', key: null, status: 'active', hours: 1, people: [], ...over });

const activity = (over: Partial<ProjectTimeActivityDto> = {}): ProjectTimeActivityDto => ({
  kind: 'project', name: 'OMS', totalHours: 0, items: [], people: [], ...over,
});

const ready = (data: ProjectTimeActivityDto) => mockQuery.mockReturnValue({ data, isLoading: false, error: null });
const render = (project = line()) =>
  renderWithProviders(<ProjectTimeDetail project={project} from="2026-09-28" to="2026-10-04" />);
const rowOf = (text: string) => screen.getByRole('row', { name: new RegExp(text) });

describe('ProjectTimeDetail', () => {
  // The shared Table's scroll-shadow measures itself with a ResizeObserver, which jsdom lacks.
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => mockQuery.mockReset());

  it('asks for the line it was opened from, over the window shown', () => {
    ready(activity());
    render(line({ kind: 'general', projectId: null }));
    expect(mockQuery).toHaveBeenCalledWith('general', null, '2026-09-28', '2026-10-04');
  });

  it('opens by task: each task with its status, who logged it and the hours, adding up to a total', () => {
    ready(activity({
      totalHours: 4,
      items: [
        item({ taskId: 't1', key: 'OMS-22', label: 'SMS spike', status: 'inQa', hours: 3,
          people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 2 }, { engineerId: 'e2', name: 'Frank Okafor', hours: 1 }] }),
        item({ taskId: 't2', key: 'OMS-23', label: 'Load test', hours: 1, people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 1 }] }),
      ],
      people: [{ engineerId: 'e1', name: 'Emma Wilson', tasks: 2, hours: 3 }, { engineerId: 'e2', name: 'Frank Okafor', tasks: 1, hours: 1 }],
    }));
    render();

    expect(screen.getByRole('tab', { name: /By task · 2/ })).toHaveAttribute('aria-selected', 'true');
    for (const header of ['Task', 'Status', 'Who logged', 'Hours'])
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    const row = within(rowOf('SMS spike'));
    expect(row.getByRole('link', { name: 'SMS spike' })).toHaveAttribute('href', '/tasks/t1');
    expect(row.getByText('OMS-22')).toBeInTheDocument();
    expect(row.getByText('In QA')).toBeInTheDocument();
    expect(row.getByText('Emma Wilson 2h · Frank Okafor 1h')).toBeInTheDocument();
    expect(row.getByText('3h')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /^Total/ })).getByText('4h')).toBeInTheDocument();
  });

  it('flips to by person: who logged, on how many tasks, and how many hours', () => {
    ready(activity({
      totalHours: 4,
      items: [item({ taskId: 't1', label: 'SMS spike', hours: 4, people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 4 }] })],
      people: [{ engineerId: 'e1', name: 'Emma Wilson', tasks: 2, hours: 3 }, { engineerId: 'e2', name: 'Frank Okafor', tasks: 1, hours: 1 }],
    }));
    render();

    fireEvent.click(screen.getByRole('tab', { name: /By person · 2/ }));

    expect(screen.getByRole('tab', { name: /By person/ })).toHaveAttribute('aria-selected', 'true');
    for (const header of ['Person', 'Tasks', 'Hours'])
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    const emma = within(rowOf('Emma Wilson'));
    expect(emma.getByText('2')).toBeInTheDocument();
    expect(emma.getByText('3h')).toBeInTheDocument();
    expect(screen.queryByText('SMS spike')).not.toBeInTheDocument();
  });

  it('breaks the General line down by category rather than task', () => {
    ready(activity({
      kind: 'general', name: 'General', totalHours: 3,
      items: [
        item({ taskId: null, label: 'Meetings', status: null, hours: 2, people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 2 }] }),
        item({ taskId: null, label: 'Admin', status: null, hours: 1, people: [{ engineerId: 'e2', name: 'Frank Okafor', hours: 1 }] }),
      ],
      people: [{ engineerId: 'e1', name: 'Emma Wilson', tasks: 0, hours: 2 }, { engineerId: 'e2', name: 'Frank Okafor', tasks: 0, hours: 1 }],
    }));
    render(line({ kind: 'general', projectId: null, projectName: 'General' }));

    expect(screen.getByRole('tab', { name: /By category · 2/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(within(rowOf('Meetings')).queryByRole('link')).not.toBeInTheDocument();
    expect(within(rowOf('Admin')).getByText('Frank Okafor 1h')).toBeInTheDocument();
  });

  it('shows the personal-tasks line as people only, with no by-task tab', () => {
    ready(activity({
      kind: 'personal', name: 'Personal tasks', totalHours: 2, items: [],
      people: [{ engineerId: 'e1', name: 'Hannah Reyes', tasks: 1, hours: 2 }],
    }));
    render(line({ kind: 'personal', projectId: null, projectName: 'Personal tasks' }));

    expect(screen.queryByRole('tab', { name: /By task/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /By person · 1/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(rowOf('Hannah Reyes')).getByText('2h')).toBeInTheDocument();
  });

  it('does not link a task the viewer cannot open', () => {
    ready(activity({
      totalHours: 1,
      items: [item({ taskId: 'x', label: 'Private task', status: null, hours: 1, people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 1 }] })],
      people: [{ engineerId: 'e1', name: 'Emma Wilson', tasks: 1, hours: 1 }],
    }));
    render();

    expect(screen.getByText('Private task')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('groups items by day, with a heading per day and the same task on different days as separate rows', () => {
    ready(activity({
      totalHours: 4,
      items: [
        item({ date: '2026-10-04', taskId: 't1', label: 'SMS spike', hours: 3, people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 3 }] }),
        item({ date: '2026-10-03', taskId: 't1', label: 'SMS spike', hours: 1, people: [{ engineerId: 'e1', name: 'Emma Wilson', hours: 1 }] }),
      ],
      people: [{ engineerId: 'e1', name: 'Emma Wilson', tasks: 1, hours: 4 }],
    }));
    render();

    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    // The more recent day's heading comes first, each followed by its own "SMS spike" row — not
    // one row with both days' hours added together.
    const iDay4 = rows.findIndex((t) => /4 Oct/.test(t) && !t.includes('SMS spike'));
    const iRow4 = rows.findIndex((t) => t.includes('SMS spike') && t.includes('3h'));
    const iDay3 = rows.findIndex((t) => /3 Oct/.test(t) && !t.includes('SMS spike'));
    const iRow3 = rows.findIndex((t) => t.includes('SMS spike') && t.includes('1h') && !t.includes('3h'));
    expect(iDay4).toBeGreaterThan(-1);
    expect(iRow4).toBeGreaterThan(iDay4);
    expect(iDay3).toBeGreaterThan(iRow4);
    expect(iRow3).toBeGreaterThan(iDay3);
  });

  it('shows the first 50 tasks and offers the rest', () => {
    const many = Array.from({ length: 53 }, (_, i) => item({ taskId: `t${i}`, label: `Task number ${i}`, hours: 1, people: [] }));
    ready(activity({ totalHours: 53, items: many, people: [{ engineerId: 'e1', name: 'Emma Wilson', tasks: 53, hours: 53 }] }));
    render();

    expect(screen.queryByText('Task number 52')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 53' }));
    expect(screen.getByText('Task number 52')).toBeInTheDocument();
  });

  it('shows empty, loading and error states', () => {
    ready(activity());
    const first = render();
    expect(screen.getByText(/no hours logged in this window/i)).toBeInTheDocument();
    first.unmount();

    mockQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const second = render();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    second.unmount();

    mockQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('x') });
    render();
    expect(screen.getByText(/couldn't load this breakdown/i)).toBeInTheDocument();
  });
});
