import { useSearchParams } from 'react-router-dom';

type FilterSchema = Record<string, string>;

/**
 * URL-backed replacement for a page's local `useState` filter fields. Values round-trip
 * through the query string (`replace`d, so typing/selecting never spams browser history —
 * only pagination pushes new entries) so a list page's filters survive navigating away and
 * back, unlike component state which resets on remount. A filter matching its default is
 * omitted from the URL entirely, keeping unfiltered URLs plain (`/tasks`, not `/tasks?status=`).
 *
 * `paginationKeys` are query params (typically a paired `useCursorPagination`'s cursor/page
 * keys) to strip on every filter change, in the SAME `setSearchParams` call. Changing a filter
 * and resetting pagination must be one atomic write: two independent `useSearchParams`-backed
 * hooks each build their patch from the same pre-update snapshot, so calling them back-to-back
 * in one handler makes the second call silently clobber the first (it has no idea about the
 * update that hasn't committed yet).
 */
export function useUrlFilters<T extends FilterSchema>(defaults: T, paginationKeys: readonly string[] = []) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = searchParams.get(key);
    if (value !== null) (filters as Record<string, string>)[key] = value;
  }

  const applyUpdates = (updates: Partial<T>) => {
    const next = new URLSearchParams(searchParams);
    for (const key of Object.keys(updates)) {
      const value = updates[key];
      if (value === undefined || value === defaults[key]) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    for (const key of paginationKeys) next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const setFilter = <K extends keyof T & string>(key: K, value: T[K]) =>
    applyUpdates({ [key]: value } as unknown as Partial<T>);

  const setFilters = (updates: Partial<T>) => applyUpdates(updates);

  const clearFilters = () => applyUpdates(defaults);

  return [filters as T, setFilter, setFilters, clearFilters] as const;
}
