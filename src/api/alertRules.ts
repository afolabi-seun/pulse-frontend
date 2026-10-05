import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { AlertRuleDto, AlertMetric, AlertScopeType, AlertComparator } from '../types/api';

export interface CreateAlertRuleRequest {
  name: string;
  metric: AlertMetric;
  scopeType: AlertScopeType;
  scopeId: string;
  comparator: AlertComparator;
  threshold: number;
  deliverInApp: boolean;
  deliverEmail: boolean;
  deliverWebhook?: boolean;
  webhookUrl?: string;
  slackChannel?: string;
  googleChatSpaceId?: string;
}

export interface UpdateAlertRuleRequest {
  name: string;
  comparator: AlertComparator;
  threshold: number;
  deliverInApp: boolean;
  deliverEmail: boolean;
  isActive?: boolean;
  deliverWebhook?: boolean;
  webhookUrl?: string;
  slackChannel?: string;
  googleChatSpaceId?: string;
}

export interface GoogleChatSpaceOption {
  spaceId: string;
  displayName: string;
}

const alertRuleKeys = {
  all: () => ['alert-rules'] as const,
  googleChatSpaces: () => ['alert-rules', 'google-chat-spaces'] as const,
};

export function useMyAlertRules() {
  return useQuery({
    queryKey: alertRuleKeys.all(),
    queryFn: () => client.get<AlertRuleDto[]>('/alert-rules').then((r) => r.data),
  });
}

// Only spaces the app has actually been added to — see ListGoogleChatSpacesQuery for why an
// AlertRule can't just take an arbitrary Google Chat space name the way it can for Slack.
export function useGoogleChatSpaces() {
  return useQuery({
    queryKey: alertRuleKeys.googleChatSpaces(),
    queryFn: () => client.get<GoogleChatSpaceOption[]>('/alert-rules/google-chat-spaces').then((r) => r.data),
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAlertRuleRequest) => client.post<AlertRuleDto>('/alert-rules', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertRuleKeys.all() }),
  });
}

export function useUpdateAlertRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAlertRuleRequest) => client.patch<AlertRuleDto>(`/alert-rules/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertRuleKeys.all() }),
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/alert-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertRuleKeys.all() }),
  });
}
