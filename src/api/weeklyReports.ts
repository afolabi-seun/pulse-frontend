import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { WeeklyReportDto, SaveWeeklyReportDraftRequest } from '../types/api';

export const weeklyReportKeys = {
  detail: (teamId?: string, weekOf?: string) => ['reports', 'weekly', teamId, weekOf] as const,
};

export function useWeeklyReport(teamId?: string, weekOf?: string, enabled = true) {
  return useQuery({
    queryKey: weeklyReportKeys.detail(teamId, weekOf),
    queryFn: () =>
      client.get<WeeklyReportDto>('/reports/weekly', {
        params: { teamId, weekOf },
      }).then((r) => r.data),
    enabled,
  });
}

export function useSaveWeeklyReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWeeklyReportDraftRequest) =>
      client.put<WeeklyReportDto>('/reports/weekly/draft', data).then((r) => r.data),
    onSuccess: (report) => {
      qc.setQueryData(weeklyReportKeys.detail(report.teamId, report.weekOf), report);
    },
  });
}

export function useSubmitWeeklyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { teamId: string; weekOf: string }) =>
      client.post<WeeklyReportDto>('/reports/weekly/submit', data).then((r) => r.data),
    onSuccess: (report) => {
      qc.setQueryData(weeklyReportKeys.detail(report.teamId, report.weekOf), report);
    },
  });
}
