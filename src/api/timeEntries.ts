import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { taskKeys } from './tasks';
import type { ProjectTimeActivityDto, EngineerTimeActivityDto, ActiveTimerDto, TimeEntryDto, TimeEntrySummaryDto, TaskTimeSummaryDto, PagedResult } from '../types/api';

export const timeEntryKeys = {
  all:         ()                                                => ['timeEntries']                          as const,
  history:     (engineerId?: string, cursor?: string)            => ['timeEntries', 'history', engineerId, cursor] as const,
  range:       (engineerId?: string, from?: string, to?: string) => ['timeEntries', 'range', engineerId, from, to] as const,
  summary:     (weekOf?: string)                                 => ['timeEntries', 'summary', weekOf]        as const,
  summaryRange: (from?: string, to?: string)                     => ['timeEntries', 'summary', 'range', from, to] as const,
  taskSummary: (taskId?: string)                                 => ['timeEntries', 'taskSummary', taskId]    as const,
  activeTimer: ()                                                => ['timeEntries', 'activeTimer']            as const,
};

export function useTimeEntryHistory(engineerId?: string, cursor?: string) {
  return useQuery({
    queryKey: timeEntryKeys.history(engineerId, cursor),
    queryFn: () =>
      client.get<PagedResult<TimeEntryDto>>('/time-entries', {
        params: { engineerId, cursor, limit: 20 },
      }).then((r) => r.data),
  });
}

/** Who logged the hours behind one "Hours by project" line, and on what — the Time Summary project drill-down. */
export function useProjectTimeActivity(
  kind: 'project' | 'general' | 'personal', projectId: string | null, from: string, to: string, enabled = true,
) {
  return useQuery({
    queryKey: ['timeEntries', 'projectActivity', kind, projectId, from, to] as const,
    queryFn: () =>
      client.get<ProjectTimeActivityDto>('/time-entries/project-activity', {
        params: { kind, projectId: projectId ?? undefined, from, to },
      }).then((r) => r.data),
    enabled,
  });
}

/** Assigned tasks vs time logged, for one engineer over a period — the Time Summary drill-down. */
export function useEngineerTimeActivity(engineerId: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['timeEntries', 'engineerActivity', engineerId, from, to] as const,
    queryFn: () =>
      client.get<EngineerTimeActivityDto>('/time-entries/engineer-activity', {
        params: { engineerId, from, to },
      }).then((r) => r.data),
    enabled,
  });
}

export function useTimeEntriesInRange(from: string, to: string, engineerId?: string, enabled = true) {
  return useQuery({
    queryKey: timeEntryKeys.range(engineerId, from, to),
    queryFn: () =>
      client.get<PagedResult<TimeEntryDto>>('/time-entries', {
        params: { engineerId, from, to },
      }).then((r) => r.data),
    enabled,
  });
}

export function useTimeEntrySummary(weekOf?: string, enabled = true) {
  return useQuery({
    queryKey: timeEntryKeys.summary(weekOf),
    queryFn: () =>
      client.get<TimeEntrySummaryDto>('/time-entries/summary', {
        params: weekOf ? { weekOf } : undefined,
      }).then((r) => r.data),
    enabled,
  });
}

// An explicit from/to overrides the default Monday-Sunday week with an arbitrary range (up to 62
// days) — used by the daily-breakdown view, which isn't bound to calendar-week boundaries.
export function useTimeEntrySummaryRange(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: timeEntryKeys.summaryRange(from, to),
    queryFn: () =>
      client.get<TimeEntrySummaryDto>('/time-entries/summary', {
        params: { from, to },
      }).then((r) => r.data),
    enabled,
  });
}

/** Downloads the Time Summary as a CSV file. Pass weekOf for the Monday-Sunday week, or from/to
 *  together for an arbitrary range — mirrors useTimeEntrySummary/useTimeEntrySummaryRange's own
 *  split, and downloadPmoCsv's blob-download approach (the endpoint needs the auth header a plain
 *  <a href> can't carry). */
export async function downloadTimeSummaryCsv(params: { weekOf?: string; from?: string; to?: string }) {
  const response = await client.get('/time-entries/summary/csv', {
    params,
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = params.from && params.to ? `${params.from}_${params.to}` : params.weekOf ?? 'current';
  a.download = `time-summary-${suffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useTaskTimeSummary(taskId?: string) {
  return useQuery({
    queryKey: timeEntryKeys.taskSummary(taskId),
    queryFn: () =>
      client.get<TaskTimeSummaryDto>(`/time-entries/task-summary/${taskId}`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export interface LogTimeEntryRequest {
  date: string;
  category: string;
  taskId?: string;
  projectId?: string;
  hours: number;
  note?: string;
}

export function useLogTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LogTimeEntryRequest) =>
      client.post<TimeEntryDto>('/time-entries', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: timeEntryKeys.all() }),
  });
}

// Mutate-time-parameterized create-or-update, for the weekly grid's per-cell commits — a
// per-id hook (like useLogTimeEntry) can't be called inside a per-cell loop (Rules of Hooks).
export function useSaveTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: LogTimeEntryRequest }) =>
      id
        ? client.put<TimeEntryDto>(`/time-entries/${id}`, body).then((r) => r.data)
        : client.post<TimeEntryDto>('/time-entries', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: timeEntryKeys.all() }),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/time-entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: timeEntryKeys.all() }),
  });
}

// ── Start/stop timer ─────────────────────────────────────────────────────────

export function useActiveTimer(enabled = true) {
  return useQuery({
    queryKey: timeEntryKeys.activeTimer(),
    // The running clock itself ticks client-side off startedAt — this query is only for
    // initial/cross-device state, so no polling interval is needed.
    queryFn: () => client.get<ActiveTimerDto | null>('/time-entries/timer/active').then((r) => r.data),
    enabled,
  });
}

export interface StartTimerRequest {
  category: string;
  taskId?: string;
  points?: number;
  subtaskId?: string;
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartTimerRequest) =>
      client.post<ActiveTimerDto>('/time-entries/timer/start', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeEntryKeys.activeTimer() });
      qc.invalidateQueries({ queryKey: timeEntryKeys.all() });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TimeEntryDto>('/time-entries/timer/stop').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeEntryKeys.activeTimer() });
      qc.invalidateQueries({ queryKey: timeEntryKeys.all() });
    },
  });
}
