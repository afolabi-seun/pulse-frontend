import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAllTasks, useInfiniteTaskList } from '../tasks';
import client from '../client';

vi.mock('../client', () => ({ default: { get: vi.fn() } }));

const task = (id: string) => ({ id, title: id, status: 'active' });
const page = (ids: string[], next: string | null) => ({ data: { items: ids.map(task), nextCursor: next, hasMore: next !== null } });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe('task list paging hooks', () => {
  beforeEach(() => vi.mocked(client.get).mockReset());

  it('useAllTasks keeps loading pages until there are none left, in order', async () => {
    vi.mocked(client.get)
      .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
      .mockResolvedValueOnce(page(['c', 'd'], 'c2'))
      .mockResolvedValueOnce(page(['e'], null));

    const { result } = renderHook(() => useAllTasks({ epicId: 'epic', limit: 100 }), { wrapper });

    await waitFor(() => expect(result.current.items.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'e']));
    expect(result.current.truncated).toBe(false);
    // Each follow-up request carries the cursor the previous page handed back.
    expect(vi.mocked(client.get).mock.calls.map((c) => (c[1] as { params: { cursor?: string } }).params.cursor))
      .toEqual([undefined, 'c1', 'c2']);
  });

  it('useInfiniteTaskList loads one page and waits to be asked for the next', async () => {
    vi.mocked(client.get)
      .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
      .mockResolvedValueOnce(page(['c'], null));

    const { result } = renderHook(() => useInfiniteTaskList({ projectId: 'p', limit: 100 }), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);
    expect(client.get).toHaveBeenCalledTimes(1);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.items.map((t) => t.id)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useAllTasks does nothing while disabled', async () => {
    const { result } = renderHook(() => useAllTasks({ sprintId: undefined, limit: 100 }, false), { wrapper });

    expect(result.current.items).toEqual([]);
    expect(client.get).not.toHaveBeenCalled();
  });
});
