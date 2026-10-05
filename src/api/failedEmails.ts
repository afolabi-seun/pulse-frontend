import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { FailedEmailDto, FailedEmailPageDto, RetryAllResult } from '../types/api';

export interface FailedEmailParams {
  includeResolved?: boolean;
  limit?: number;
  cursor?: string;
}

export const failedEmailKeys = {
  all:  ()                         => ['failed-emails']              as const,
  list: (p: FailedEmailParams)     => ['failed-emails', 'list', p]  as const,
};

export function useFailedEmails(params: FailedEmailParams) {
  return useQuery({
    queryKey: failedEmailKeys.list(params),
    queryFn: () => client.get<FailedEmailPageDto>('/failed-emails', { params }).then((r) => r.data),
  });
}

export function useRetryFailedEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      client.post<FailedEmailDto>(`/failed-emails/${id}/retry`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: failedEmailKeys.all() }),
  });
}

export function useRetryAllFailedEmails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      client.post<RetryAllResult>('/failed-emails/retry-all').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: failedEmailKeys.all() }),
  });
}

export function useDismissFailedEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      client.delete<FailedEmailDto>(`/failed-emails/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: failedEmailKeys.all() }),
  });
}
