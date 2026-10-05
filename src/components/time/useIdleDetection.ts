import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const CHECK_INTERVAL_MS = 15_000;

/**
 * Flags `idle: true` once no mouse/keyboard/scroll/touch activity has happened in this tab for
 * `thresholdMs`, while `active` is true. Listeners are only attached while `active`, so an idle
 * timer costs nothing when no Pulse timer is running.
 *
 * Once idle fires, further activity stops resetting the clock on its own — a stray mouse twitch
 * while reading the resulting prompt shouldn't silently dismiss it. Call `resetIdle()` from the
 * prompt's own response to clear it.
 *
 * This can only observe activity in this browser tab while it's open and the machine is awake —
 * it says nothing about a closed laptop or a background tab, which is a real limitation to be
 * upfront about rather than a bug.
 */
export function useIdleDetection(active: boolean, thresholdMs: number) {
  const [idle, setIdle] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const idleRef = useRef(false);

  useEffect(() => { idleRef.current = idle; }, [idle]);

  useEffect(() => {
    if (!active) {
      setIdle(false);
      lastActivityRef.current = Date.now();
      return;
    }

    const onActivity = () => {
      if (idleRef.current) return;
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const interval = setInterval(() => {
      if (!idleRef.current && Date.now() - lastActivityRef.current >= thresholdMs) {
        setIdle(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [active, thresholdMs]);

  const resetIdle = () => {
    lastActivityRef.current = Date.now();
    setIdle(false);
  };

  return { idle, resetIdle };
}
