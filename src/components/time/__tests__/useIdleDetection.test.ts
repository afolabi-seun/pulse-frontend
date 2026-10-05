import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useIdleDetection } from '../useIdleDetection';

const THRESHOLD = 15 * 60 * 1000;

describe('useIdleDetection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays non-idle while inactive tracking is off', () => {
    const { result } = renderHook(() => useIdleDetection(false, THRESHOLD));
    act(() => { vi.advanceTimersByTime(THRESHOLD + 60_000); });
    expect(result.current.idle).toBe(false);
  });

  it('flags idle once the threshold elapses with no activity', () => {
    const { result } = renderHook(() => useIdleDetection(true, THRESHOLD));
    expect(result.current.idle).toBe(false);
    act(() => { vi.advanceTimersByTime(THRESHOLD + 16_000); }); // past threshold + one check tick
    expect(result.current.idle).toBe(true);
  });

  it('does not flag idle if activity keeps resetting the clock', () => {
    const { result } = renderHook(() => useIdleDetection(true, THRESHOLD));
    // Nudge activity every 5 minutes, well under the 15-minute threshold, across a long span.
    for (let i = 0; i < 6; i++) {
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        window.dispatchEvent(new Event('mousemove'));
      });
    }
    expect(result.current.idle).toBe(false);
  });

  it('ignores activity once idle until resetIdle is called explicitly', () => {
    const { result } = renderHook(() => useIdleDetection(true, THRESHOLD));
    act(() => { vi.advanceTimersByTime(THRESHOLD + 16_000); });
    expect(result.current.idle).toBe(true);

    // A stray mousemove while the "still working?" prompt is up must not silently clear it.
    act(() => { window.dispatchEvent(new Event('mousemove')); });
    expect(result.current.idle).toBe(true);

    act(() => { result.current.resetIdle(); });
    expect(result.current.idle).toBe(false);
  });

  it('resets to non-idle when tracking turns off (timer stopped)', () => {
    const { result, rerender } = renderHook(({ active }) => useIdleDetection(active, THRESHOLD), {
      initialProps: { active: true },
    });
    act(() => { vi.advanceTimersByTime(THRESHOLD + 16_000); });
    expect(result.current.idle).toBe(true);

    rerender({ active: false });
    expect(result.current.idle).toBe(false);
  });
});
