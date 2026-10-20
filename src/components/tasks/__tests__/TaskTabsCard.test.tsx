import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TaskTabsCard from '../TaskTabsCard';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { toIsoDate } from '../../../lib/dates';
import type { TaskDto } from '../../../types/api';

const mocks = vi.hoisted(() => ({ tasks: vi.fn(), baseline: vi.fn() }));

vi.mock('../../../api/tasks', () => ({ useTaskList: (params: unknown, enabled?: boolean) => mocks.tasks(params, enabled) }));
vi.mock('../../../api/reports', () => ({ useReportingBaseline: () => ({ data: mocks.baseline() }) }));

const task = (over: Partial<TaskDto>): TaskDto => ({
  id: 't', title: 'A task', taskKey: 'APP-1', status: 'active', points: 3, dueDate: null, actualEndDate: null, sentToQaAt: null,
  projectName: 'Mobile App', pausedAt: null, ...over,
} as TaskDto);

/** Answers each request the way the API would: only tasks whose status is in the request's `statuses`. */
function serve(all: TaskDto[]) {
  mocks.tasks.mockImplementation((params: { statuses?: string }) => {
    const wanted = (params.statuses ?? '').split(',').filter(Boolean);
    const items = all.filter((t) => wanted.includes(t.status.toLowerCase()));
    return { data: { items, hasMore: false, nextCursor: null }, isLoading: false };
  });
}

const lastCall = (predicate: (p: Record<string, unknown>) => boolean) =>
  [...mocks.tasks.mock.calls].reverse().map((c) => c[0] as Record<string, unknown>).find(predicate);

const historyCall = () => lastCall((p) => String(p.statuses).includes('done'));

function show() {
  return renderWithProviders(<TaskTabsCard assigneeId="eng-1" onPreview={vi.fn()} />, { initialEntries: ['/engineers/eng-1'] });
}

const sample = [
  task({ id: 'a', title: 'Live work', status: 'active' }),
  task({ id: 'b', title: 'Stuck work', status: 'blocked' }),
  task({ id: 'c', title: 'Held work', status: 'paused', pausedAt: '2020-01-06T10:00:00Z' }),
  task({ id: 'd', title: 'With QA', status: 'inQa' }),
  task({ id: 'e', title: 'Not started', status: 'backlog', points: 0 }),
  task({ id: 'f', title: 'Shipped', status: 'done', actualEndDate: '2026-10-10' }),
];

describe('TaskTabsCard', () => {
  beforeEach(() => {
    mocks.tasks.mockReset();
    mocks.baseline.mockReturnValue(null);
    serve(sample);
  });

  it('opens on Current with only the work that counts toward workload', () => {
    show();

    expect(screen.getByRole('tab', { name: 'Current' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Live work/)).toBeInTheDocument();
    expect(screen.getByText(/Stuck work/)).toBeInTheDocument();
    expect(screen.queryByText(/Held work/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shipped/)).not.toBeInTheDocument();
    expect(lastCall((p) => p.statuses === 'active,blocked')).toBeDefined();
  });

  it('says what the Current tab leaves out, and links to History', async () => {
    show();

    const note = screen.getByText(/Not counted in workload:/);
    expect(note).toHaveTextContent('1 In QA');
    expect(note).toHaveTextContent('1 Paused');
    expect(note).toHaveTextContent('1 Backlog');

    await userEvent.click(within(note).getByRole('button', { name: 'See History' }));
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  });

  it('says nothing about left-out work when there is none', () => {
    serve([task({ id: 'a', title: 'Live work', status: 'active' })]);
    show();

    expect(screen.queryByText(/Not counted in workload/)).not.toBeInTheDocument();
  });

  it('shows finished, in-QA, paused and backlog work in History, last 30 days by default', async () => {
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(screen.getByText(/Shipped/)).toBeInTheDocument();
    expect(screen.getByText(/With QA/)).toBeInTheDocument();
    expect(screen.getByText(/Held work/)).toBeInTheDocument();
    expect(screen.getByText(/Not started/)).toBeInTheDocument();
    expect(screen.queryByText(/Live work/)).not.toBeInTheDocument();
    const call = historyCall()!;
    expect(call.statuses).toBe('done,inqa,backlog,paused');
    expect(call.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.dateTo).toBeUndefined();
    expect(call.sortBy).toBe('actualEndDate');
  });

  it('narrows to the chosen statuses, and sorts by due date when nothing finished is in the list', async () => {
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    expect(historyCall()!.statuses).toBe('done');
    expect(historyCall()!.sortBy).toBe('actualEndDate');
    expect(screen.getByText(/Shipped/)).toBeInTheDocument();
    expect(screen.queryByText(/With QA/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('button', { name: 'Paused' }));
    const unfinished = lastCall((p) => p.statuses === 'paused')!;
    expect(unfinished.sortBy).toBe('dueDate');
  });

  it('clears the start date on All time, and resets everything on Reset', async () => {
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    await userEvent.click(screen.getByRole('button', { name: 'All time' }));
    expect(historyCall()!.dateFrom).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(historyCall()!.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  const isoDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toIsoDate(d);
  };

  it('offers From reporting start only when a baseline is set, and uses it', async () => {
    mocks.baseline.mockReturnValue(isoDaysAgo(90));
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(historyCall()!.dateFrom).toBe(isoDaysAgo(30)); // the default, since the baseline is older than that

    await userEvent.click(screen.getByRole('button', { name: 'From reporting start' }));

    expect(historyCall()!.dateFrom).toBe(isoDaysAgo(90));
  });

  it('opens History at the reporting start date when that is later than 30 days ago', async () => {
    mocks.baseline.mockReturnValue(isoDaysAgo(5));
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(historyCall()!.dateFrom).toBe(isoDaysAgo(5));
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument(); // the default is not a change
  });

  it('opens History 30 days back when the reporting start date is older, or there is none', async () => {
    mocks.baseline.mockReturnValue(null);
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(historyCall()!.dateFrom).toBe(isoDaysAgo(30));
  });

  it('lets All time go past the reporting start date, and Reset returns to it', async () => {
    mocks.baseline.mockReturnValue(isoDaysAgo(5));
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    await userEvent.click(screen.getByRole('button', { name: 'All time' }));
    expect(historyCall()!.dateFrom).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(historyCall()!.dateFrom).toBe(isoDaysAgo(5));
  });

  it('does not offer From reporting start without a baseline', async () => {
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(screen.queryByRole('button', { name: 'From reporting start' })).not.toBeInTheDocument();
  });

  it('says how many working days a task has been paused', async () => {
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(screen.getByText(/paused \d{3,} working days/)).toBeInTheDocument();
  });

  it('flags a Backlog task with no estimate, but not an estimated one', async () => {
    serve([task({ id: 'e', title: 'Not started', status: 'backlog', points: 0 }), task({ id: 'g', title: 'Groomed', status: 'backlog', points: 5 })]);
    show();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(screen.getAllByText(/needs an estimate before time can be logged/)).toHaveLength(1);
  });

  it('shows an empty message per tab', async () => {
    serve([]);
    show();
    expect(screen.getByText('No tasks in progress.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('No tasks match these filters.')).toBeInTheDocument();
  });
});

