import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TimerBar from '../TimerBar';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { TaskDto } from '../../../types/api';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ currentUser: { id: 'eng-1', name: 'Alice' }, allow: () => true }),
}));

vi.mock('../../../api/timeEntries', () => ({
  useActiveTimer: () => ({ data: null, isLoading: false }),
  useStartTimer: () => ({ mutate: vi.fn(), isPending: false }),
  useStopTimer: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../api/tasks', () => ({
  useTaskList: () => ({ data: undefined, isError: false }),
  useSubtasks: () => ({ data: [] }),
}));

const KEY = 'pulse_timer_draft_eng-1';
const task = { id: 't1', title: 'Fix login', taskKey: 'APP-1', status: 'active' } as TaskDto;

const seed = (taskId: string) => sessionStorage.setItem(KEY, JSON.stringify({
  category: 'task', taskSource: 'mine', taskId, subtaskId: '', unclaimedProjectId: '',
}));

describe('TimerBar draft selection', () => {
  beforeEach(() => sessionStorage.clear());

  it('restores a previously picked task after the page is left and re-opened', () => {
    seed('t1');
    renderWithProviders(<TimerBar openTasks={[task]} myProjects={[]} />);

    expect(screen.getByDisplayValue('APP-1 — Fix login')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeEnabled();
  });

  it('drops a restored task that is no longer in the engineer\'s open tasks', async () => {
    seed('gone');
    renderWithProviders(<TimerBar openTasks={[task]} myProjects={[]} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /start/i })).toBeDisabled());
    expect(JSON.parse(sessionStorage.getItem(KEY)!).taskId).toBe('');
  });

  it('does not drop the selection while the task list is still loading', () => {
    seed('t1');
    renderWithProviders(<TimerBar openTasks={[]} myProjects={[]} tasksLoaded={false} />);

    expect(JSON.parse(sessionStorage.getItem(KEY)!).taskId).toBe('t1');
  });
});
