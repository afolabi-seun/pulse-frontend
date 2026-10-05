import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { AuditLogPageDto } from '../types/api';

export interface AuditLogParams {
  cursor?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const auditLogKeys = {
  all:  ()                      => ['auditLog']             as const,
  list: (p: AuditLogParams)     => ['auditLog', 'list', p]  as const,
};

export function useAuditLog(params: AuditLogParams) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () =>
      client.get<AuditLogPageDto>('/audit-log', { params }).then((r) => r.data),
  });
}

export function useMyAuditLog(limit = 25) {
  return useQuery({
    queryKey: ['auditLog', 'me', limit],
    queryFn: () =>
      client.get<AuditLogPageDto>('/audit-log/me', { params: { limit } }).then((r) => r.data),
  });
}
