import { describe, it, expect } from 'vitest';
import { pointsChangeNeedsReason, weeklyBaselinePoints } from '../points';

describe('pointsChangeNeedsReason', () => {
  it('needs a reason to change an existing estimate on a task that has been started', () => {
    expect(pointsChangeNeedsReason({ points: 3, status: 'active' }, 8)).toBe(true);
    expect(pointsChangeNeedsReason({ points: 3, status: 'blocked' }, '8' as unknown as number)).toBe(true);
    expect(pointsChangeNeedsReason({ points: 3, status: 'paused' }, 5)).toBe(true);
  });

  it('does not for the first estimate on an unpointed task', () => {
    expect(pointsChangeNeedsReason({ points: 0, status: 'active' }, 5)).toBe(false);
  });

  it('does not while the task is still in Backlog', () => {
    expect(pointsChangeNeedsReason({ points: 3, status: 'backlog' }, 5)).toBe(false);
  });

  it('does not for a finished or in-QA task, which cannot be edited', () => {
    expect(pointsChangeNeedsReason({ points: 3, status: 'done' }, 5)).toBe(false);
    expect(pointsChangeNeedsReason({ points: 3, status: 'inQa' }, 5)).toBe(false);
  });

  it('does not when the points are unchanged, or the field is empty', () => {
    expect(pointsChangeNeedsReason({ points: 3, status: 'active' }, 3)).toBe(false);
    expect(pointsChangeNeedsReason({ points: 3, status: 'active' }, '')).toBe(false);
    expect(pointsChangeNeedsReason({ points: 3, status: 'active' }, undefined)).toBe(false);
  });
});

describe('weeklyBaselinePoints', () => {
  it('restates a per-cycle baseline as a weekly rate', () => {
    expect(weeklyBaselinePoints(12, 3)).toBe(28);
    expect(weeklyBaselinePoints(20, 5)).toBe(28);
    expect(weeklyBaselinePoints(14, 7)).toBe(14);
  });

  it('is zero when there is no usable baseline', () => {
    expect(weeklyBaselinePoints(0, 5)).toBe(0);
    expect(weeklyBaselinePoints(20, 0)).toBe(0);
  });
});
