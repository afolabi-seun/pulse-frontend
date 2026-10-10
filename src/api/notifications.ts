import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { ChatChannel, NotificationDto, PagedResult, NotificationPreferenceDto, PersonalChatSettingsDto } from '../types/api';

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

export const notificationPreferenceKeys = {
  all: () => ['notifications', 'preferences'] as const,
};

/** Every notification kind and whether it's emailed to the caller. */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationPreferenceKeys.all(),
    queryFn: () => client.get<NotificationPreferenceDto[]>('/notifications/preferences').then((r) => r.data!),
  });
}

/** Switches email and/or chat on or off for one kind — optimistically, rolled back if the save fails. */
export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, ...change }: { kind: string; email?: boolean; chat?: boolean }) =>
      client.put<NotificationPreferenceDto>(`/notifications/preferences/${encodeURIComponent(kind)}`, change).then((r) => r.data!),
    onMutate: async ({ kind, ...change }) => {
      await qc.cancelQueries({ queryKey: notificationPreferenceKeys.all() });
      const previous = qc.getQueryData<NotificationPreferenceDto[]>(notificationPreferenceKeys.all());
      qc.setQueryData<NotificationPreferenceDto[]>(notificationPreferenceKeys.all(),
        (prefs) => prefs?.map((p) => (p.kind === kind ? { ...p, ...change } : p)));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(notificationPreferenceKeys.all(), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationPreferenceKeys.all() }),
  });
}

export const personalChatKeys = {
  settings: () => ['notifications', 'chat'] as const,
};

/** Where the caller's notifications are also sent as personal chat messages, and what's available. */
export function usePersonalChatSettings() {
  return useQuery({
    queryKey: personalChatKeys.settings(),
    queryFn: () => client.get<PersonalChatSettingsDto>('/notifications/chat').then((r) => r.data!),
  });
}

export function useUpdatePersonalChatChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: ChatChannel) =>
      client.put<PersonalChatSettingsDto>('/notifications/chat', { channel }).then((r) => r.data!),
    onSuccess: (settings) => qc.setQueryData(personalChatKeys.settings(), settings),
  });
}
