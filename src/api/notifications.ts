import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { NotificationDto, PagedResult } from '../types/api';

export const notificationKeys = {
  all:  ()               => ['notifications']          as const,
  list: (cursor?: string) => ['notifications', cursor]  as const,
};

export function useNotifications(cursor?: string) {
  return useQuery({
    queryKey: notificationKeys.list(cursor),
    queryFn: () =>
      client.get<PagedResult<NotificationDto>>('/notifications', {
        params: { cursor, limit: 25 },
      }).then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all() }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all() }),
  });
}
