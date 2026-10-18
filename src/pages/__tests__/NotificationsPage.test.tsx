import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotificationsPage from '../NotificationsPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { NotificationDto } from '../../types/api';

const escalated: NotificationDto = {
  id: 'n1', userId: 'head-1', kind: 'estimate_approval_escalated', channel: 'InApp',
  isRead: false, readAt: null, sentAt: '2026-10-04T10:00:00Z',
  payload: JSON.stringify({
    taskId: 'task-9', taskTitle: 'Build rate limiting service', points: 8,
    assigneeName: 'Emma Wilson', teamLeadName: 'Carol Lead',
  }),
};

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));

const mockNotifications = vi.hoisted(() => vi.fn());
vi.mock('../../api/notifications', () => ({
  useNotifications:           () => mockNotifications(),
  useMarkNotificationRead:    () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../components/tasks/TaskPreviewDrawer', () => ({
  default: ({ taskId }: { taskId: string | null }) => (taskId ? <div data-testid="drawer">{taskId}</div> : null),
}));

function renderPage() {
  mockNotifications.mockReturnValue({
    data: { items: [escalated], hasMore: false, nextCursor: null },
    isLoading: false, error: null, refetch: vi.fn(),
  });
  return renderWithProviders(<NotificationsPage />);
}

describe('NotificationsPage — estimate approval escalation', () => {
  it('shows a proper title, the task and who the estimate is waiting on', () => {
    renderPage();
    expect(screen.getByText('Estimate approval overdue — needs your attention')).toBeInTheDocument();
    expect(screen.getByText(/Build rate limiting service/)).toBeInTheDocument();
    expect(screen.getByText('8 pts for Emma Wilson — waiting on Carol Lead')).toBeInTheDocument();
  });

  it('opens the task when the row is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Estimate approval overdue/ }));
    expect(screen.getByTestId('drawer')).toHaveTextContent('task-9');
  });

  it('is listed under the Task updates tab', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Task updates' }));
    expect(screen.getByText('Estimate approval overdue — needs your attention')).toBeInTheDocument();
  });
});

describe('NotificationsPage: the daily due-date digest', () => {
  const digest: NotificationDto = {
    id: 'd1', userId: 'head-1', kind: 'escalation_digest', channel: 'InApp',
    isRead: false, readAt: null, sentAt: '2026-10-14T09:00:00Z', payload: JSON.stringify({ count: 7, overdue: 3 }),
  };
  const show = (items: NotificationDto[]) => {
    mockNotifications.mockReturnValue({ data: { items, hasMore: false, nextCursor: null }, isLoading: false, error: null, refetch: vi.fn() });
    return renderWithProviders(<NotificationsPage />);
  };

  beforeEach(() => navigate.mockClear());

  it('says how many tasks need attention, and how many are overdue', () => {
    show([digest]);

    expect(screen.getByText('Tasks need your attention')).toBeInTheDocument();
    expect(screen.getByText(/7 tasks, 3 overdue/)).toBeInTheDocument();
  });

  it('uses the singular for one task and leaves out an overdue count of zero', () => {
    show([{ ...digest, payload: JSON.stringify({ count: 1, overdue: 0 }) }]);

    expect(screen.getByText(/— 1 task$/)).toBeInTheDocument();
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });

  it('opens the Escalations page when clicked, since it names no single task', () => {
    show([digest]);

    fireEvent.click(screen.getByRole('button', { name: /Tasks need your attention/ }));

    expect(navigate).toHaveBeenCalledWith('/escalations');
  });

  it('is listed under the Escalations tab', () => {
    show([digest, escalated]);

    fireEvent.click(screen.getByRole('button', { name: 'Escalations' }));

    expect(screen.getByText('Tasks need your attention')).toBeInTheDocument();
    expect(screen.queryByText('Estimate approval overdue — needs your attention')).not.toBeInTheDocument();
  });
});

describe('NotificationsPage: paused-task reminder and PMO escalation', () => {
  const show = (items: NotificationDto[]) => {
    mockNotifications.mockReturnValue({ data: { items, hasMore: false, nextCursor: null }, isLoading: false, error: null, refetch: vi.fn() });
    return renderWithProviders(<NotificationsPage />);
  };
  const reminder: NotificationDto = {
    id: 'p1', userId: 'lead-1', kind: 'paused_task_reminder', channel: 'InApp',
    isRead: false, readAt: null, sentAt: '2026-10-14T09:00:00Z', payload: JSON.stringify({ count: 3 }),
  };

  beforeEach(() => navigate.mockClear());

  it('says how many tasks have sat paused', () => {
    show([reminder]);

    expect(screen.getByText('Paused tasks need a decision')).toBeInTheDocument();
    expect(screen.getByText(/3 tasks paused for a week or more/)).toBeInTheDocument();
  });

  it('opens the task list when clicked, since it names no single task', () => {
    show([reminder]);

    fireEvent.click(screen.getByRole('button', { name: /Paused tasks need a decision/ }));

    expect(navigate).toHaveBeenCalledWith('/tasks');
  });

  it('is listed under the Escalations tab', () => {
    show([reminder]);

    fireEvent.click(screen.getByRole('button', { name: 'Escalations' }));

    expect(screen.getByText('Paused tasks need a decision')).toBeInTheDocument();
  });

  it('tells the PMO that neither the team lead nor the department head has acted', () => {
    show([{
      id: 'e1', userId: 'pm-1', kind: 'estimate_approval_escalated', channel: 'InApp', isRead: false, readAt: null, sentAt: '2026-10-14T09:00:00Z',
      payload: JSON.stringify({ taskId: 't1', taskTitle: 'Fix login', points: 5, assigneeName: 'Ada', teamLeadName: 'Lena Lead, Hari Head', tier: 'pmo' }),
    }]);

    expect(screen.getByText(/5 pts for Ada — waiting on Lena Lead, Hari Head — neither the team lead nor the department head has acted/)).toBeInTheDocument();
  });
});
