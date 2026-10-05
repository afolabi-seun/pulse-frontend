import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
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
