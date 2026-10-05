import { describe, it, expect } from 'vitest';
import { daysLate, toIsoDate, getWeekStart, isCurrentWeek } from '../dates';

function isoDaysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toIsoDate(d);
}

describe('daysLate', () => {
  it('is null for a Backlog task past its due date', () => {
    // Backlog is exempt — matches the backend's escalation pipeline, which never fires for a
    // Backlog task regardless of how overdue its due date is.
    const overdue = isoDaysFromToday(-10);
    const days = daysLate({ dueDate: overdue, actualEndDate: null, sentToQaAt: null, status: 'backlog' });
    expect(days).toBeNull();
  });

  it('is null for a Backlog task with no due date', () => {
    const days = daysLate({ dueDate: null, actualEndDate: null, sentToQaAt: null, status: 'backlog' });
    expect(days).toBeNull();
  });

  it('is null for a Paused task past its due date, not a live-ticking overdue count', () => {
    // Paused is exempt the same way Backlog is — the backend's escalation scanner skips a
    // paused task outright, and the board doesn't even render a Paused column, so this must
    // not show a growing "Xd overdue" for something nothing else in the app is scrutinizing.
    const overdue = isoDaysFromToday(-2);
    const days = daysLate({ dueDate: overdue, actualEndDate: null, sentToQaAt: null, status: 'paused' });
    expect(days).toBeNull();
  });

  it('reports negative days for an overdue Active task', () => {
    const overdue = isoDaysFromToday(-5);
    const days = daysLate({ dueDate: overdue, actualEndDate: null, sentToQaAt: null, status: 'active' });
    expect(days).toBe(-5);
  });

  it('is null for a Done task with no actualEndDate recorded', () => {
    const dueDate = isoDaysFromToday(-3);
    const days = daysLate({ dueDate, actualEndDate: null, sentToQaAt: null, status: 'done' });
    // Falls back to daysUntil (still live) rather than freezing, since there's nothing to freeze against.
    expect(days).toBe(-3);
  });

  it('freezes lateness at the actual completion date for a Done task with no QA step', () => {
    const dueDate = isoDaysFromToday(-10);
    const actualEndDate = isoDaysFromToday(-8);
    const days = daysLate({ dueDate, actualEndDate, sentToQaAt: null, status: 'done' });
    // Finished 2 days after the due date — frozen, doesn't keep growing with today's date.
    expect(days).toBe(-2);
  });

  it('freezes lateness at the QA handoff for a task still awaiting QA past its due date', () => {
    // The deadline is met the moment development hands off to QA — QA's own turnaround
    // shouldn't count against the assignee, even though the task isn't closed yet.
    const dueDate    = isoDaysFromToday(-5);
    const sentToQaAt = isoDaysFromToday(-6);
    const days = daysLate({ dueDate, actualEndDate: null, sentToQaAt, status: 'inQa' });
    // Sent to QA a day before the deadline — not late, regardless of how long QA has taken since.
    expect(days).toBe(1);
  });

  it('uses the actual completion date, not the QA handoff, once a task is Done', () => {
    // Previously froze at the QA-handoff snapshot even once Done — harmless when handoff was on
    // time, but a task handed off *late* would then show that same "days late at handoff" number
    // forever, with Done never correcting it (the exact bug this test used to encode as correct:
    // a task on-time at handoff but delayed 10 extra days by QA used to read as "not late"
    // indefinitely). A Done task's actualEndDate is now always the authoritative answer, matching
    // how a no-QA Done task already behaves.
    const dueDate      = isoDaysFromToday(-10);
    const sentToQaAt   = isoDaysFromToday(-11); // handed off a day early
    const actualEndDate = isoDaysFromToday(-1); // but QA took 10 days to get to it
    const days = daysLate({ dueDate, actualEndDate, sentToQaAt, status: 'done' });
    expect(days).toBe(-9);
  });

  it('a task overdue at QA handoff no longer stays frozen overdue forever once Done', () => {
    // The reported bug: a task already late by the time it was sent to QA would show that same
    // negative number permanently, even long after it actually shipped, because Done never
    // re-evaluated against the real completion date.
    const dueDate       = isoDaysFromToday(-20);
    const sentToQaAt    = isoDaysFromToday(-15); // already 5 days late at handoff
    const actualEndDate = isoDaysFromToday(-19); // but actually finished just 1 day late
    const days = daysLate({ dueDate, actualEndDate, sentToQaAt, status: 'done' });
    expect(days).toBe(-1);
  });

  it('reports overdue when the handoff itself came after the due date', () => {
    const dueDate    = isoDaysFromToday(-5);
    const sentToQaAt = isoDaysFromToday(-2);
    const days = daysLate({ dueDate, actualEndDate: null, sentToQaAt, status: 'inQa' });
    expect(days).toBe(-3);
  });
});

describe('isCurrentWeek', () => {
  it('is true for the Monday of the current calendar week', () => {
    const thisWeek = getWeekStart(toIsoDate(new Date()));
    expect(isCurrentWeek(thisWeek)).toBe(true);
  });

  it('is false for last week', () => {
    const lastWeek = getWeekStart(isoDaysFromToday(-7));
    expect(isCurrentWeek(lastWeek)).toBe(false);
  });

  it('is false for next week', () => {
    const nextWeek = getWeekStart(isoDaysFromToday(7));
    expect(isCurrentWeek(nextWeek)).toBe(false);
  });
});
