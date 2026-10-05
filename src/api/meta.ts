import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { AppMetaDto } from '../types/api';

export const metaKeys = {
  all: () => ['meta'] as const,
};

export function useMeta() {
  return useQuery({
    queryKey: metaKeys.all(),
    queryFn: () => client.get<AppMetaDto>('/meta').then((r) => r.data!),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
