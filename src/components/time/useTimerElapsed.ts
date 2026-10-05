import { useEffect, useState } from 'react';

const STALE_THRESHOLD_SECONDS = 8 * 3600;

export function useTimerElapsed(startedAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return { label: '00:00:00', stale: false };

  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  const label = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

  return { label, stale: seconds >= STALE_THRESHOLD_SECONDS };
}
