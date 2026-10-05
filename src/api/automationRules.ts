import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { AutomationRuleDto } from '../types/api';

export interface CreateAutomationRuleRequest {
  name: string;
  teamId: string;
  thresholdDays: number;
}

export interface UpdateAutomationRuleRequest {
  name: string;
  thresholdDays: number;
  isActive?: boolean;
}

const automationRuleKeys = {
  all: () => ['automation-rules'] as const,
};

export function useMyAutomationRules() {
  return useQuery({
    queryKey: automationRuleKeys.all(),
    queryFn: () => client.get<AutomationRuleDto[]>('/automation-rules').then((r) => r.data),
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAutomationRuleRequest) => client.post<AutomationRuleDto>('/automation-rules', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationRuleKeys.all() }),
  });
}

export function useUpdateAutomationRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAutomationRuleRequest) => client.patch<AutomationRuleDto>(`/automation-rules/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationRuleKeys.all() }),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/automation-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationRuleKeys.all() }),
  });
}
