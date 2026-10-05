import type { TaskStatus } from '@/types/api';

// ISO date string → "24 May 2026" (null → "Unscheduled")
export function formatDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ISO datetime string → "3m ago" / "2h ago" / "5d ago"
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ISO datetime string → "24 May 2026, 10:15"
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// "2026-05-24" (DateOnly from API) → Date object (local midnight, for day-count display)
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date object → "2026-05-24", using LOCAL date components. Date#toISOString() converts to UTC
// first, which silently shifts the calendar date by a day in any timezone ahead of or behind
// UTC — always use this (never toISOString().slice(0, 10)) when serializing a local Date back
// to a DateOnly-shaped string for the API or for display.
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Today's date as "2026-05-24", local-timezone-safe (see toIsoDate).
export function todayIso(): string {
  return toIsoDate(new Date());
}

// "2026-05-24" → end-of-day UTC (23:59:59Z), matching the backend's TimeOnly.MaxValue.
// Use this for escalation threshold calculations, not for display.
export function parseDueDateEndOfDay(s: string | null): Date | null {
  if (!s) return null;
  return new Date(s + 'T23:59:59Z');
}

// Days from today until the given ISO date string (negative = past). Null when no due date.
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDateOnly(iso);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Days a task is/was late against its due date. Same sign convention as daysUntil (negative =
// late). For an open task this is live against today; for a Done task it's frozen at how late it
// was when it actually finished, so closing a task stops its lateness from growing forever.
// A Backlog task is never "late" — the backend's own escalation pipeline treats Backlog as exempt
// (a due date can be set long before a task is groomed/activated), so the UI must match that
// rather than showing red "overdue" styling for something the system itself never escalates.
// A Paused task is exempt the same way — the backend's escalation scanner skips it outright
// ("the engineer has voluntarily paused the task"), and the board doesn't even render a Paused
// column for the same reason, so a live-ticking "Xd overdue" here would contradict every other
// surface's treatment of a paused task as not currently being scrutinized for lateness at all.
// Once a task has been sent to QA, the deadline is considered met right there — QA's own
// turnaround shouldn't count against the assignee while the task is still sitting in the queue,
// even though it isn't formally closed (per the current DoD) until QA passes it. sentToQaAt is
// cleared by a QA rejection, so a resubmitted task is judged on its next handoff rather than its
// first. Once a task reaches Done, though, its own actualEndDate is the authoritative answer —
// checked first, below — not the QA-handoff freeze: a task handed off late and then rejected/
// reworked for weeks would otherwise show that same original "days late at handoff" number
// forever, even long after it actually closed, which is what made a finished task permanently
// read as overdue everywhere its status showed up (Dashboard, boards, project health, ...).
export function daysLate(task: { dueDate: string | null; actualEndDate: string | null; sentToQaAt: string | null; status: TaskStatus }): number | null {
  if (!task.dueDate || task.status === 'backlog' || task.status === 'paused') return null;
  if (task.status === 'done') {
    if (!task.actualEndDate) return daysUntil(task.dueDate);
    const due = parseDateOnly(task.dueDate);
    const actual = parseDateOnly(task.actualEndDate);
    return Math.round((due.getTime() - actual.getTime()) / 86_400_000);
  }
  if (task.sentToQaAt) {
    const due = parseDateOnly(task.dueDate);
    const handoff = parseDateOnly(task.sentToQaAt);
    return Math.round((due.getTime() - handoff.getTime()) / 86_400_000);
  }
  return daysUntil(task.dueDate);
}

// "2026-05-24" → Monday of that week as "2026-05-18"
export function weekLabel(iso: string): string {
  return `w/c ${formatDate(iso)}`;
}

// Any date → the Monday on or before it, as "2026-05-18".
export function getWeekStart(iso: string): string {
  // parseDateOnly (not `new Date(iso)`) — a bare date-only string parses as UTC midnight per
  // spec, which can land on the wrong local calendar day before .getDay()/.getDate() even run.
  const d   = parseDateOnly(iso);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toIsoDate(d);
}

// Whether the given Monday-of-week date is the current, still-in-progress calendar week — i.e.
// today falls inside it. Reports compare "this week" against a complete previous week with no
// caveat otherwise, so a week viewed before Sunday night structurally reads as a decline purely
// from elapsed time, not performance. Callers use this to show an "in progress" note instead.
export function isCurrentWeek(weekOfIso: string): boolean {
  return weekOfIso === getWeekStart(todayIso());
}
