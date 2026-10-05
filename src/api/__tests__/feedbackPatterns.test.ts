import { describe, it, expect } from 'vitest';
import { normalizeFeedbackPatterns } from '../feedback';

describe('normalizeFeedbackPatterns', () => {
  const weeks = [{ weekOf: '2026-09-14', totalResponses: 5, distinctSources: 5 }];

  it('passes the current object shape through', () => {
    expect(normalizeFeedbackPatterns({ weeks, hiddenWeeks: 2, eligiblePeople: 10, scope: 'Core Banking' }))
      .toEqual({ weeks, hiddenWeeks: 2, eligiblePeople: 10, scope: 'Core Banking' });
  });

  it('accepts the older bare list from a backend that has not been updated yet', () => {
    expect(normalizeFeedbackPatterns(weeks))
      .toEqual({ weeks, hiddenWeeks: 0, eligiblePeople: 0, scope: 'Organisation' });
  });

  it('never leaves weeks undefined, whatever comes back', () => {
    expect(normalizeFeedbackPatterns(undefined).weeks).toEqual([]);
    expect(normalizeFeedbackPatterns(null).weeks).toEqual([]);
    expect(normalizeFeedbackPatterns({}).weeks).toEqual([]);
  });
});
