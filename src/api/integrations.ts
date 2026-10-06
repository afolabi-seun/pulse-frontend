import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { GoogleChatConnectionDto, GoogleChatLinkCodeDto, SlackConnectionDto } from '../types/api';

export const integrationKeys = {
  slack: () => ['integrations', 'slack'] as const,
  googleChat: () => ['integrations', 'google-chat'] as const,
};

/** The caller's organization's Slack workspace connection. */
export function useSlackConnection() {
  return useQuery({
    queryKey: integrationKeys.slack(),
    queryFn: () => client.get<SlackConnectionDto>('/integrations/slack').then((r) => r.data!),
  });
}

/** Fetches a fresh "Add to Slack" URL (valid ten minutes) and sends the browser there. */
export function useConnectSlack() {
  return useMutation({
    mutationFn: () => client.get<string>('/integrations/slack/install-url').then((r) => r.data!),
    onSuccess: (url) => window.location.assign(url),
  });
}

export function useDisconnectSlack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete<boolean>('/integrations/slack').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.slack() }),
  });
}

/** Whether Google Chat is set up on the server, and the spaces linked to the caller's organization. */
export function useGoogleChatConnection() {
  return useQuery({
    queryKey: integrationKeys.googleChat(),
    queryFn: () => client.get<GoogleChatConnectionDto>('/integrations/google-chat').then((r) => r.data!),
  });
}

/** Issues a one-time code (valid fifteen minutes) to type in a space as "@Pulse link CODE". */
export function useCreateGoogleChatLinkCode() {
  return useMutation({
    mutationFn: () => client.post<GoogleChatLinkCodeDto>('/integrations/google-chat/link-codes').then((r) => r.data!),
  });
}

export function useUnlinkGoogleChatSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<boolean>(`/integrations/google-chat/spaces/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.googleChat() }),
  });
}
