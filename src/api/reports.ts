import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { LeadershipReportDto, OrgTrendDto, PmoReportDto } from '../types/api';

export const reportKeys = {
  leadership: (weekOf?: string) => ['reports', 'leadership', weekOf] as const,
  pmo: (from?: string, to?: string) => ['reports', 'pmo', from, to] as const,
  orgTrend: () => ['reports', 'org-trend'] as const,
  baseline: () => ['reports', 'baseline'] as const,
};

export function useLeadershipReport(weekOf?: string) {
  return useQuery({
    queryKey: reportKeys.leadership(weekOf),
    queryFn: () =>
      client.get<LeadershipReportDto>('/reports/leadership', {
        params: weekOf ? { weekOf } : undefined,
      }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function usePmoReport(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.pmo(from, to),
    queryFn: () =>
      client.get<PmoReportDto>('/reports/pmo', {
        params: { from, to },
      }).then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useOrgTrend(enabled = true) {
  return useQuery({
    queryKey: reportKeys.orgTrend(),
    queryFn: () => client.get<OrgTrendDto>('/reports/org-trend').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export async function downloadLeadershipPdf(weekOf?: string) {
  const response = await client.get('/reports/leadership/pdf', {
    params: weekOf ? { weekOf } : undefined,
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leadership-report-${weekOf ?? 'current'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadWeeklyReportDocx(teamId?: string, weekOf?: string) {
  const response = await client.get('/reports/weekly/docx', {
    params: { teamId, weekOf },
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weekly-report-${weekOf ?? 'current'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPmoCsv(from?: string, to?: string) {
  const response = await client.get('/reports/pmo/csv', {
    params: { from, to },
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = from && to ? `${from}_${to}` : from || to || 'current';
  a.download = `pmo-report-${suffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** The day reports and charts start from; null when there is none. */
export function useReportingBaseline() {
  return useQuery({
    queryKey: reportKeys.baseline(),
    queryFn: () => client.get<{ date: string | null }>('/reports/baseline').then((r) => r.data.date),
    staleTime: 10 * 60_000,
  });
}

/** PMO only. A null date removes the baseline. Nothing is deleted either way. */
export function useSetReportingBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string | null) => client.put<{ date: string | null }>('/reports/baseline', { date }).then((r) => r.data.date),
    // Every report and chart depends on it.
    onSuccess: () => qc.invalidateQueries(),
  });
}
