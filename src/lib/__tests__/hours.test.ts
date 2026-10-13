import { describe, it, expect } from 'vitest';
import { round2, sumHours, formatHours } from '../hours';

describe('sumHours', () => {
  it('adds hours exactly: 0.93 + 2.49 is 3.42, not 3.4200000000000004', () => {
    expect(0.93 + 2.49).not.toBe(3.42);            // the problem this exists for
    expect(0.93 + 2.49).toBe(3.4200000000000004);
    expect(sumHours([0.93, 2.49])).toBe(3.42);
  });

  it.each([[0.43, 2.99], [0.45, 2.97], [0.68, 2.74], [0.93, 2.49]])('%d + %d is exactly 3.42', (a, b) => {
    expect(sumHours([a, b])).toBe(3.42);
  });

  it.each([
    [[0.1, 0.2], 0.3],
    [[0.1, 0.7], 0.8],
    [[0.35, 0.35, 0.35], 1.05],
    [[4.54, 3.42], 7.96],
    [[0.06, 0.06, 0.06, 0.06, 0.06], 0.3],
    [[2.675, 1.005], 3.69],                          // stray third decimals are rounded per value, then added
    [[8, 8, 8, 8, 8], 40],
    [[], 0],
  ])('%j adds up to %d', (values, expected) => {
    expect(sumHours(values as number[])).toBe(expected);
  });

  it('never returns more than two decimals, whatever it is given', () => {
    const awkward = Array.from({ length: 200 }, (_, i) => ((i * 37) % 97) / 100 + 0.01);
    const total = sumHours(awkward);

    expect(Number(total.toFixed(2))).toBe(total);
    expect(String(total)).not.toMatch(/\.\d{3,}/);
  });
});

describe('round2', () => {
  it.each([
    [3.4200000000000004, 3.42],
    [1.005, 1.01],            // half rounds up (Math.round(1.005 * 100) gives 100)
    [2.675, 2.68],
    [10.005, 10.01],
    [8.345, 8.35],
    [0.004, 0],
    [0.005, 0.01],
    [1.5, 1.5],
    [0, 0],
  ])('%d rounds to %d', (given, expected) => {
    expect(round2(given)).toBe(expected);
  });

  it('turns a non-number into 0 instead of NaN', () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('formatHours', () => {
  it('shows at most two decimals and drops a pointless ".0"', () => {
    expect(formatHours(3.4200000000000004)).toBe('3.42h');
    expect(formatHours(4.5)).toBe('4.5h');
    expect(formatHours(2)).toBe('2h');
    expect(formatHours(0)).toBe('0h');
    expect(formatHours(sumHours([0.1, 0.2]))).toBe('0.3h');
  });
});
