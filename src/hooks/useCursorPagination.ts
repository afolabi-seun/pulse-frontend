import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

interface UseCursorPaginationOptions<C> {
  /** Query param name holding the cursor. Only needs overriding when a page has more than
   * one paginated region (e.g. a tab's own list) and the default would collide. */
  urlKey?: string;
  serialize?: (cursor: C) => string;
  deserialize?: (raw: string) => C;
}

/**
 * Cursor pagination backed by the URL rather than component state, so a list survives
 * navigating away and back (a detail page, then browser/breadcrumb back) with its page
 * intact instead of remounting to page 1. Paging forward pushes a new browser history
 * entry — that entry *is* the "previous page" stack, so `goPrev` just steps back through
 * real history rather than needing its own in-memory copy of every prior cursor.
 *
 * Trade-off: a keyset cursor can't be inverted, so `goPrev` only works when the user
 * arrived by paging forward in this session. A fresh deep link or a hard refresh mid-
 * pagination has no prior entry to step back to, so it falls back to jumping to page 1
 * rather than erroring.
 */
export function useCursorPagination<C = string>(options: UseCursorPaginationOptions<C> = {}) {
  const {
    urlKey = 'cursor',
    serialize = (c: C) => String(c),
    deserialize = (raw: string) => raw as unknown as C,
  } = options;
  const pageKey = `${urlKey}Page`;

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const rawCursor = searchParams.get(urlKey);
  const cursor = rawCursor === null ? undefined : deserialize(rawCursor);
  const pageNumber = Number(searchParams.get(pageKey) ?? '1') || 1;

  const goNext = (nextCursor: C) => {
    const next = new URLSearchParams(searchParams);
    next.set(urlKey, serialize(nextCursor));
    next.set(pageKey, String(pageNumber + 1));
    setSearchParams(next); // push — a real history entry for goPrev/browser-back to land on
  };

  const goPrev = () => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    // No real in-app history (fresh deep link / hard refresh) — nothing to step back to.
    const next = new URLSearchParams(searchParams);
    next.delete(urlKey);
    next.delete(pageKey);
    setSearchParams(next, { replace: true });
  };

  const reset = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(urlKey);
    next.delete(pageKey);
    setSearchParams(next, { replace: true });
  };

  return { cursor, hasPrev: cursor !== undefined, pageNumber, goNext, goPrev, reset };
}
