import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { EngineerDto, EngineerListPageDto, OverworkSignalsDto, OverworkOverrideDto, BaselineHistoryEntryDto, ThroughputWeekDto } from '../types/api';

export const engineerKeys = {
  all:             ()          => ['engineers']                             as const,
  page:            (params: { cursor?: string; teamId?: string; isActive?: boolean }) =>
    ['engineers', 'page', params]                                           as const,
  detail:          (id: string) => ['engineers', id]                        as const,
  signals:         (id: string) => ['engineers', id, 'signals']             as const,
  overrides:       (id: string) => ['engineers', id, 'overrides']           as const,
  baselineHistory: (id: string) => ['engineers', id, 'baseline-history']   as const,
  throughput:      (id: string) => ['engineers', id, 'throughput']         as const,
  loanCandidates:  ()          => ['engineers', 'loan-candidates']          as const,
  qaCandidates:    ()          => ['engineers', 'qa-candidates']            as const,
  prApprovalCandidates: ()     => ['engineers', 'pr-approval-candidates']   as const,
  projectAssignable: (projectId: string) => ['engineers', 'project-assignable', projectId] as const,
};

export function useEngineerList(enabled = true) {
  return useQuery({
    queryKey: engineerKeys.all(),
    queryFn: () => client.get<EngineerDto[]>('/engineers').then((r) => r.data),
    enabled,
  });
}

/** Paged, row-filterable variant — used only by the Engineers page's own grid. Every other
 * caller that needs the full roster keeps using useEngineerList(). */
export function useEngineerListPage(params: { cursor?: string; teamId?: string; isActive?: boolean; limit?: number }) {
  return useQuery({
    queryKey: engineerKeys.page(params),
    queryFn: () => client.get<EngineerListPageDto>('/engineers/page', { params }).then((r) => r.data),
  });
}

export function useLoanCandidates(enabled = true) {
  return useQuery({
    queryKey: engineerKeys.loanCandidates(),
    queryFn: () => client.get<EngineerDto[]>('/engineers/loan-candidates').then((r) => r.data),
    enabled,
  });
}

/** Active, QA-flagged engineers org-wide, unscoped by department — backs the QA task Assignee
 * picker so a department head (e.g. Head of Engineering) can still see a reviewer who sits in a
 * different department, the way useEngineerList()'s department-scoped roster wouldn't allow. */
export function useQaCandidates(enabled = true) {
  return useQuery({
    queryKey: engineerKeys.qaCandidates(),
    queryFn: () => client.get<EngineerDto[]>('/engineers/qa-candidates').then((r) => r.data),
    enabled,
  });
}

/** Active Team-Lead-or-above engineers org-wide — backs the PR-approval "reassign approver"
 * picker, unscoped by department for the same reason useLoanCandidates/useQaCandidates are:
 * the point is picking someone other than the unavailable default department head. */
export function usePrApprovalCandidates(enabled = true) {
  return useQuery({
    queryKey: engineerKeys.prApprovalCandidates(),
    queryFn: () => client.get<EngineerDto[]>('/engineers/pr-approval-candidates').then((r) => r.data),
    enabled,
  });
}

/** Active engineers who actually work on a given project — its owner team's roster plus explicit
 * project members — regardless of the caller's own department. Backs the normal-task Assignee
 * picker the same way useQaCandidates backs the QA one: a department head managing a project
 * outside their own department still needs to see that project's real team. */
export function useProjectAssignableEngineers(projectId: string, enabled = true) {
  return useQuery({
    queryKey: engineerKeys.projectAssignable(projectId),
    queryFn: () => client.get<EngineerDto[]>(`/engineers/project-assignable/${projectId}`).then((r) => r.data),
    enabled: enabled && !!projectId,
  });
}

export function useEngineer(id: string) {
  return useQuery({
    queryKey: engineerKeys.detail(id),
    queryFn: () => client.get<EngineerDto>(`/engineers/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useEngineerThroughput(id: string) {
  return useQuery({
    queryKey: engineerKeys.throughput(id),
    queryFn: () => client.get<ThroughputWeekDto[]>(`/engineers/${id}/throughput`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpdateEngineer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { baselinePoints?: number; baselineCycleDays?: number }) =>
      client.patch<EngineerDto>(`/engineers/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: engineerKeys.detail(id) }),
  });
}

export function useEngineerSignals(id: string) {
  return useQuery({
    queryKey: engineerKeys.signals(id),
    queryFn: () => client.get<OverworkSignalsDto>(`/engineers/${id}/signals`).then((r) => r.data),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateOverride(engineerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { reason: string; expiresAt?: string }) =>
      client.post<OverworkOverrideDto>(`/engineers/${engineerId}/override`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engineerKeys.signals(engineerId) });
      qc.invalidateQueries({ queryKey: engineerKeys.overrides(engineerId) });
    },
  });
}

export function useEngineerOverrides(engineerId: string) {
  return useQuery({
    queryKey: engineerKeys.overrides(engineerId),
    queryFn: () => client.get<OverworkOverrideDto[]>(`/engineers/${engineerId}/overrides`).then((r) => r.data),
    enabled: !!engineerId,
  });
}

export function useBaselineHistory(engineerId: string, enabled = true) {
  return useQuery({
    queryKey: engineerKeys.baselineHistory(engineerId),
    queryFn: () =>
      client.get<BaselineHistoryEntryDto[]>(`/engineers/${engineerId}/baseline-history`).then((r) => r.data),
    enabled: !!engineerId && enabled,
  });
}
