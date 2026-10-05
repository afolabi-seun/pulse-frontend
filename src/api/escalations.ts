import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { EscalationDto } from '../types/api';

export const escalationKeys = {
  all: () => ['escalations'] as const,
};

export function useEscalations(enabled = true) {
  return useQuery({
    queryKey: escalationKeys.all(),
    queryFn: () => client.get<EscalationDto[]>('/escalations').then((r) => r.data),
    staleTime: 60_000,
    enabled,
  });
}
