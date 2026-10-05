import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionState } from '../useSessionState';

describe('useSessionState', () => {
  beforeEach(() => sessionStorage.clear());

  it('restores the value after the component unmounts and remounts', () => {
    const first = renderHook(() => useSessionState<string[]>('k', []));
    act(() => first.result.current[1](['a', 'b']));
    first.unmount();

    const second = renderHook(() => useSessionState<string[]>('k', []));
    expect(second.result.current[0]).toEqual(['a', 'b']);
  });

  it('keeps separate keys apart (one user never sees another user\'s draft)', () => {
    const a = renderHook(() => useSessionState('user-a', ''));
    act(() => a.result.current[1]('mine'));

    const b = renderHook(() => useSessionState('user-b', ''));
    expect(b.result.current[0]).toBe('');
  });

  it('reset returns to the initial value, in state and in storage', () => {
    const hook = renderHook(() => useSessionState('k', 'initial'));
    act(() => hook.result.current[1]('changed'));
    act(() => hook.result.current[2]());

    expect(hook.result.current[0]).toBe('initial');
    expect(sessionStorage.getItem('k')).toBe(JSON.stringify('initial'));
  });

  it('falls back to the initial value when the stored value is corrupt', () => {
    sessionStorage.setItem('k', '{not json');
    const hook = renderHook(() => useSessionState('k', 'fallback'));
    expect(hook.result.current[0]).toBe('fallback');
  });
});
