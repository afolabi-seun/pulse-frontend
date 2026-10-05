import { screen, within, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import EngineerTimeDetail from '../EngineerTimeDetail';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { ActivityTaskDto, EngineerTimeActivityDto } from '../../../types/api';

const mockQuery = vi.fn();
vi.mock('../../../api/timeEntries', () => ({
  useEngineerTimeActivity: (...args: unknown[]) => mockQuery(...args),
}));

const task = (over: Partial<ActivityTaskDto>): ActivityTaskDto => ({
  taskId: 't', key: null, title: 'A task', projectName: null, status: 'active', dueDate: null, hours: 0, entries: [], ...over,
});

const activity = (over: Partial<EngineerTimeActivityDto> = {}): EngineerTimeActivityDto => ({
  assigned: [], loggedOnly: [], otherTime: [], assignedWithoutTime: 0, ...over,
});

const ready = (data: EngineerTimeActivityDto) => mockQuery.mockReturnValue({ data, isLoading: false, error: null });
const render = () => renderWithProviders(<EngineerTimeDetail engineerId="e1" from="2026-09-28" to="2026-10-04" />);
const rowOf = (title: string) => screen.getByRole('row', { name: new RegExp(title) });
const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('EngineerTimeDetail', () => {
  // The shared Table's scroll-shadow measures itself with a ResizeObserver, which jsdom lacks.
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => mockQuery.mockReset());

  it('asks for the engineer and window it was given', () => {
    ready(activity());
    render();
    expect(mockQuery).toHaveBeenCalledWith('e1', '2026-09-28', '2026-10-04');
  });

  it('opens on the logged time: the tasks with hours, biggest first, adding up to the total', () => {
    ready(activity({
      assigned: [
        task({ taskId: 'a', title: 'Small one', hours: 1.5 }),
        task({ taskId: 'n', title: 'Never touched', hours: 0 }),
      ],
      loggedOnly: [task({ taskId: 'b', title: 'Big finished one', status: 'done', hours: 10 })],
      otherTime: [{ category: 'meeting', hours: 2 }],
    }));
    render();

    expect(tab(/Logged time · 13.5h/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/11.5h on 2 tasks \+ 2h other time/)).toBeInTheDocument();
    const dataRows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    expect(dataRows.findIndex((t) => t.includes('Big finished one'))).toBeLessThan(dataRows.findIndex((t) => t.includes('Small one')));
    expect(screen.queryByText('Never touched')).not.toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /^Total on tasks/ })).getByText('11.5h')).toBeInTheDocument();
  });

  it('shows each logged task as a table row: task, project, status, due date, days logged and hours', () => {
    ready(activity({
      assigned: [
        task({ taskId: 't1', key: 'APP-12', title: 'Fix the login bug', projectName: 'Web App', status: 'inQa', dueDate: '2099-10-09', hours: 3.5,
          entries: [{ date: '2026-09-29', hours: 2.5, note: 'Reproduced it' }, { date: '2026-09-30', hours: 1, note: null }] }),
      ],
    }));
    render();

    for (const header of ['Task', 'Project', 'Status', 'Due', 'Logged', 'Hours'])
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    const row = within(rowOf('Fix the login bug'));
    expect(row.getByRole('link', { name: 'Fix the login bug' })).toHaveAttribute('href', '/tasks/t1');
    expect(row.getByText('APP-12')).toBeInTheDocument();
    expect(row.getByText('Web App')).toBeInTheDocument();
    expect(row.getByText('In QA')).toBeInTheDocument();
    expect(row.getByText('9 Oct')).toBeInTheDocument();
    expect(row.getByText(/Tue,? 29 Sept? · 2\.5h/)).toBeInTheDocument();
    expect(row.getByText(/Wed,? 30 Sept? · 1h/)).toBeInTheDocument();
    expect(row.getByText(/Tue,? 29 Sept?: Reproduced it/)).toBeInTheDocument();
    expect(row.getByText('3.5h')).toBeInTheDocument();
  });

  it('marks time logged on work that is no longer assigned to them', () => {
    ready(activity({
      assigned: [task({ taskId: 'a', title: 'Still theirs', hours: 1 })],
      loggedOnly: [task({ taskId: 'b', title: 'Moved on', status: 'done', hours: 4 })],
    }));
    render();

    expect(within(rowOf('Moved on')).getByText('no longer assigned')).toBeInTheDocument();
    expect(within(rowOf('Still theirs')).queryByText('no longer assigned')).not.toBeInTheDocument();
  });

  it('keeps assigned work with no time logged on its own tab, with a count', () => {
    ready(activity({
      assignedWithoutTime: 2,
      assigned: [
        task({ taskId: 't1', title: 'Untouched', projectName: 'Web App', status: 'blocked', dueDate: '2099-01-02' }),
        task({ taskId: 't2', title: 'Also untouched', status: 'backlog' }),
        task({ taskId: 't3', title: 'Worked on', hours: 2 }),
      ],
    }));
    render();

    expect(tab(/Assigned, not logged · 2/)).toBeInTheDocument();
    expect(screen.queryByText('Untouched')).not.toBeInTheDocument();

    fireEvent.click(tab(/Assigned, not logged/));

    expect(tab(/Assigned, not logged/)).toHaveAttribute('aria-selected', 'true');
    const row = within(rowOf('Untouched'));
    expect(row.getByText('Blocked')).toBeInTheDocument();
    expect(row.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('Also untouched')).toBeInTheDocument();
    expect(screen.queryByText('Worked on')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Task', 'Project', 'Status', 'Due']);
  });

  it('opens on the gaps when nothing was logged at all', () => {
    ready(activity({ assigned: [task({ taskId: 't1', title: 'Untouched' })] }));
    render();

    expect(tab(/Assigned, not logged · 1/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Untouched')).toBeInTheDocument();
  });

  it('only calls an unfinished, started task overdue — not a backlog or finished one', () => {
    ready(activity({
      assigned: [
        task({ taskId: 'a', title: 'Late and active', status: 'active', dueDate: '2020-01-02', hours: 1 }),
        task({ taskId: 'b', title: 'Old backlog', status: 'backlog', dueDate: '2020-01-03', hours: 1 }),
      ],
      loggedOnly: [task({ taskId: 'c', title: 'Old and done', status: 'done', dueDate: '2020-01-04', hours: 1 })],
    }));
    render();

    expect(within(rowOf('Late and active')).getByText('2 Jan')).toHaveClass('text-red-600');
    expect(within(rowOf('Old backlog')).getByText('3 Jan')).not.toHaveClass('text-red-600');
    expect(within(rowOf('Old and done')).getByText('4 Jan')).not.toHaveClass('text-red-600');
  });

  it('lists the non-task categories in their own table on the logged tab', () => {
    ready(activity({ otherTime: [{ category: 'meeting', hours: 2 }, { category: 'leave', hours: 8 }] }));
    render();

    expect(screen.getByRole('columnheader', { name: 'Other time' })).toBeInTheDocument();
    expect(within(rowOf('Meetings')).getByText('2h')).toBeInTheDocument();
    expect(within(rowOf('Leave')).getByText('8h')).toBeInTheDocument();
  });

  it('shows someone else\'s personal task without a link or any real name', () => {
    ready(activity({ assigned: [task({ taskId: 'p1', title: 'Personal task', projectName: 'Personal tasks', hours: 3 })] }));
    render();

    expect(screen.getByText('Personal task')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says so when everything assigned has time logged, and shows empty, loading and error states', () => {
    ready(activity({ assigned: [task({ taskId: 'a', title: 'Done in period', hours: 1 })] }));
    const first = render();
    fireEvent.click(tab(/Assigned, not logged/));
    expect(screen.getByText(/everything assigned to them has time logged/i)).toBeInTheDocument();
    first.unmount();

    ready(activity());
    const second = render();
    expect(screen.getByText(/nothing assigned and no entries/i)).toBeInTheDocument();
    second.unmount();

    mockQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const third = render();
    expect(screen.getByText(/loading entries/i)).toBeInTheDocument();
    third.unmount();

    mockQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('x') });
    render();
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });
});
