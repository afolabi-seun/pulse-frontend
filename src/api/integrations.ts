import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { SlackConnectionDto } from '../types/api';

export const integrationKeys = {
  slack: () => ['integrations', 'slack'] as const,
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
