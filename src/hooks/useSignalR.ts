import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { buildHubConnection } from '../lib/signalr';
import { notificationKeys } from '../api/notifications';
import { taskKeys } from '../api/tasks';
import { useAuth } from './useAuth';
import type { NotificationDto, TaskDto } from '../types/api';

function notificationTaskId(n: NotificationDto): string | undefined {
  if (!n.payload) return undefined;
  try {
    return (JSON.parse(n.payload) as Record<string, unknown>)['taskId'] as string | undefined;
  } catch { return undefined; }
}

// Retries the initial hub start with exponential back-off.
// withAutomaticReconnect only re-connects after a disconnect — it does not
// cover the initial start() if the API isn't ready yet on page load.
// `isDisposed` stops the loop once the component has unmounted, so a retry can't revive a
// connection the cleanup already tore down.
async function startWithRetry(
  conn: { start: () => Promise<void> },
  isDisposed: () => boolean,
  delays = [1_000, 3_000, 6_000],
): Promise<void> {
  for (const delay of delays) {
    if (isDisposed()) return;
    try { await conn.start(); return; } catch { /* will retry */ }
    await new Promise<void>((r) => setTimeout(r, delay));
  }
  if (isDisposed()) return;
  // Final attempt — let the caller's catch handle it
  await conn.start();
}

const KIND_LABEL: Record<string, string> = {
  escalation_t3:      'Task escalation — due in 3 days',
  escalation_t1:      'Task escalation — due tomorrow',
  escalation_overdue: 'Task is now overdue',
  checkin_reminder:   'Check-in reminder',
  weekly_vitals_prompt:'Weekly vitals prompt',
  qa_rejected:        'QA rejected — rework required',
  qa_accepted:        'QA passed — task is done',
  qa_unassigned:      'Your QA task has no reviewer yet',
  task_unblocked:     'A blocker was resolved — you can proceed',
  task_assigned:      'A task has been assigned to you',
  task_loaned:        'A task has been loaned to you from another department',
  task_recalled:      'A task loaned to you has been recalled',
};

export function useSignalR() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    // A fresh connection per effect run (StrictMode mounts, unmounts, then remounts in dev) —
    // reusing one object across that cycle raced stop() against an in-flight start().
    const conn = buildHubConnection();
    let disposed = false;

    conn.on('role.changed', () => {
      // An admin changed this user's role — pick up the new capability set without forcing
      // a re-login. Non-fatal on failure: worst case it stays stale until the next token refresh.
      refreshUser()
        .then(() => toast.info('Your role was updated — permissions refreshed.'))
        .catch(() => {});
    });

    conn.on('notification.received', (notification: NotificationDto) => {
      // Refresh notification inbox so badge count and list update immediately.
      qc.invalidateQueries({ queryKey: notificationKeys.all() });
      const label  = KIND_LABEL[notification.kind] ?? 'New notification';
      const taskId = notificationTaskId(notification);
      toast(label, {
        duration: 6000,
        action: taskId ? { label: 'View', onClick: () => navigate(`/tasks/${taskId}`) } : undefined,
      });
    });

    conn.on('task.updated', (task: TaskDto) => {
      // Refresh the specific task detail and any list that might include it.
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    });

    const started = startWithRetry(conn, () => disposed).catch(() => {
      // Non-fatal — app works without real-time; notifications update on next manual refresh.
    });

    return () => {
      disposed = true;
      // Stop only once any in-flight start has settled: stopping mid-negotiation makes SignalR
      // log "The connection was stopped during negotiation" as an error.
      started.then(() => conn.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
