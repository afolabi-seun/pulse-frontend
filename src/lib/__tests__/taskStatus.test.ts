import { describe, it, expect } from 'vitest';
import { backlogExitHint } from '../taskStatus';

describe('backlogExitHint', () => {
  it('mentions both an assignee and points when neither is set', () => {
    const hint = backlogExitHint(false, 0);
    expect(hint).toContain('assignee');
    expect(hint).toContain('points');
  });

  it('mentions only an assignee when points are already set', () => {
    const hint = backlogExitHint(false, 3);
    expect(hint).toContain('assignee');
    expect(hint).not.toContain('story points');
  });

  it('mentions only points when an assignee is already set', () => {
    const hint = backlogExitHint(true, 0);
    expect(hint).not.toContain('an assignee');
    expect(hint).toContain('points');
  });
});
