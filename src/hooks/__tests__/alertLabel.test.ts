import { describe, it, expect } from 'vitest';
import { alertLabel } from '../useSignalR';
import { toIsoDate } from '../../lib/dates';
import type { NotificationDto } from '../../types/api';

const daysFromToday = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return toIsoDate(d); };

const alert = (kind: string, dueDate?: string): NotificationDto =>
  ({ id: 'n1', userId: 'u1', kind, payload: dueDate ? JSON.stringify({ taskId: 't1', dueDate }) : null, channel: 'InApp', isRead: false, readAt: null, sentAt: new Date().toISOString() } as NotificationDto);

describe('live alert text for due-date warnings', () => {
  it('says how far away the due date really is, not the stage\'s nominal day count', () => {
    // The 3-day stage can fire with much less than 3 days left; the alert must not claim otherwise.
    expect(alertLabel(alert('escalation_t3', daysFromToday(1)))).toBe('Task due tomorrow');
    expect(alertLabel(alert('escalation_t3', daysFromToday(2)))).toBe('Task due in 2 days');
    expect(alertLabel(alert('escalation_t1', daysFromToday(0)))).toBe('Task due today');
  });

  it('never contains a hardcoded "3 days"', () => {
    expect(alertLabel(alert('escalation_t3', daysFromToday(1)))).not.toContain('3 days');
    expect(alertLabel(alert('escalation_t3'))).not.toContain('3 days');
  });

  it('falls back to a generic line when the alert carries no due date or an unreadable one', () => {
    expect(alertLabel(alert('escalation_t3'))).toBe('Task escalation — due soon');
    expect(alertLabel({ ...alert('escalation_t1'), payload: 'not json' })).toBe('Task escalation — due soon');
  });

  it('leaves other alerts as they were', () => {
    expect(alertLabel(alert('escalation_overdue', daysFromToday(-2)))).toBe('Task is now overdue');
    expect(alertLabel(alert('task_assigned'))).toBe('A task has been assigned to you');
    expect(alertLabel(alert('escalation_digest'))).toBe('Tasks need your attention — see Escalations');
    expect(alertLabel(alert('paused_task_reminder'))).toBe('Paused tasks need a decision — resume or reassign');
    expect(alertLabel(alert('something_new'))).toBe('New notification');
  });
});
