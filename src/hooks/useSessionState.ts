import { useCallback, useEffect, useRef, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * useState that survives the component unmounting (e.g. navigating to another module and back) by
 * mirroring its value into sessionStorage under `key`. Scoped to the tab, so it never outlives the
 * session. Storage can be unavailable (private mode, blocked site data), so every access is
 * best-effort and the hook degrades to plain useState.
 *
 * `key` should be user-specific so a shared browser never shows one person's draft to another.
 */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const initialRef = useRef(initial);

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch { /* best-effort only */ }
  }, [key, value]);

  // Back to the initial value (which the effect above then mirrors into storage).
  const reset = useCallback(() => setValue(initialRef.current), []);

  return [value, setValue, reset] as const;
}
