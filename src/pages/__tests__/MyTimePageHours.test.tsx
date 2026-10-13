import { screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { toast } from 'sonner';
import MyTimePage from '../MyTimePage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { toIsoDate } from '../../lib/dates';
import type { TimeEntryDto } from '../../types/api';

vi.mock('sonner', async (orig) => ({ ...(await orig<typeof import('sonner')>()), toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ currentUser: { id: 'u1', name: 'Tester' }, allow: () => true }) }));
vi.mock('../../components/time/TimerBar', () => ({ default: () => null }));
vi.mock('../../components/tasks/TaskPreviewDrawer', () => ({ default: () => null }));

const logMutate = vi.fn();
const saveMutate = vi.fn();
const deleteMutate = vi.fn();
let entries: TimeEntryDto[] = [];

vi.mock('../../api/timeEntries', () => ({
  useLogTimeEntry: () => ({ mutate: logMutate, isPending: false }),
  useSaveTimeEntry: () => ({ mutate: saveMutate, isPending: false }),
  useDeleteTimeEntry: () => ({ mutate: deleteMutate, isPending: false }),
  useTimeEntriesInRange: () => ({ data: { items: entries }, isLoading: false }),
  useTaskTimeSummary: () => ({ data: undefined }),
  useActiveTimer: () => ({ data: null }),
}));
vi.mock('../../api/tasks', () => ({ useTaskList: () => ({ data: { items: [] } }) }));
vi.mock('../../api/projects', () => ({ useMyProjects: () => ({ data: [] }) }));

const today = toIsoDate(new Date());
const todayColumn = (new Date().getDay() + 6) % 7;   // Monday = 0

const session = (id: string, hours: number): TimeEntryDto =>
  ({ id, engineerId: 'u1', date: today, category: 'meeting', taskId: null, hours } as unknown as TimeEntryDto);

const meetingRow = () => screen.getByText('Meeting').closest('tr')!;
const todayInput = () => within(meetingRow()).getAllByRole('spinbutton')[todayColumn] as HTMLInputElement;
const type = (input: HTMLInputElement, value: string) => { fireEvent.change(input, { target: { value } }); fireEvent.blur(input); };

describe('My Time: hours are added and entered to two decimals', () => {
  beforeAll(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
  beforeEach(() => { vi.clearAllMocks(); entries = []; localStorage.clear(); sessionStorage.clear(); });

  it('shows two sessions in one day as their exact sum, not 3.4200000000000004h', () => {
    entries = [session('a', 0.93), session('b', 2.49)];   // 0.93 + 2.49 is 3.4200000000000004 in plain JavaScript
    renderWithProviders(<MyTimePage />);

    // The cell for the day with two sessions (the stacked-layers button in your screenshot).
    expect(within(meetingRow()).getByTitle('2 sessions — click to view')).toHaveTextContent('3.42h');
    expect(document.body.textContent).not.toMatch(/\d\.\d{3,}h/);
  });

  it('keeps the totals in step with the cell', () => {
    entries = [session('a', 0.93), session('b', 2.49)];
    renderWithProviders(<MyTimePage />);

    // The row total, the day total and the grand total all say 3.42h.
    expect(screen.getAllByText('3.42h').length).toBeGreaterThanOrEqual(3);
  });

  it('rounds hours typed into an empty cell to two decimals before logging them', () => {
    renderWithProviders(<MyTimePage />);

    type(todayInput(), '3.4200000000000004');

    expect(logMutate).toHaveBeenCalledWith(expect.objectContaining({ hours: 3.42, category: 'meeting', date: today }), expect.anything());
  });

  it('rounds a half up: 1.005 is logged as 1.01', () => {
    renderWithProviders(<MyTimePage />);

    type(todayInput(), '1.005');

    expect(logMutate).toHaveBeenCalledWith(expect.objectContaining({ hours: 1.01 }), expect.anything());
  });

  it('rounds an edited value the same way', () => {
    entries = [session('a', 1)];
    renderWithProviders(<MyTimePage />);

    type(todayInput(), '2.675');

    expect(saveMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', body: expect.objectContaining({ hours: 2.68 }) }), expect.anything());
  });

  it('clearing a cell still removes its entry', () => {
    entries = [session('a', 1)];
    renderWithProviders(<MyTimePage />);

    type(todayInput(), '');

    expect(deleteMutate).toHaveBeenCalledWith('a', expect.anything());
  });

  it('refuses a negative number: nothing is deleted or saved, and the cell shows the saved value again', () => {
    entries = [session('a', 1.5)];
    renderWithProviders(<MyTimePage />);
    const input = todayInput();

    type(input, '-2');

    expect(toast.error).toHaveBeenCalledWith('Hours cannot be negative.');
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(saveMutate).not.toHaveBeenCalled();
    expect(input.value).toBe('1.5');
  });

  it('refuses more than 24 hours in one entry', () => {
    entries = [session('a', 1.5)];
    renderWithProviders(<MyTimePage />);
    const input = todayInput();

    type(input, '25');

    expect(toast.error).toHaveBeenCalledWith('A single entry cannot be more than 24 hours.');
    expect(saveMutate).not.toHaveBeenCalled();
    expect(input.value).toBe('1.5');
  });

  it('a value that rounds to nothing does not log a zero-hour entry', () => {
    renderWithProviders(<MyTimePage />);

    type(todayInput(), '0.004');

    expect(logMutate).not.toHaveBeenCalled();
  });
});
