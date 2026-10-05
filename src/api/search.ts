import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { SearchResultDto } from '../types/api';

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => client.get<SearchResultDto>('/search', { params: { q } }).then((r) => r.data),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });
}
