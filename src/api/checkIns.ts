import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { CheckInDto, StandupSummaryDto, StandupEntryDto, PagedResult } from '../types/api';

// The backend paginates the standup digest's `entries` field (cursor-based, same convention as
// everywhere else) so one request can never pull an unbounded day's worth of rows. The page
// itself still wants the complete day (it groups by team with fold/unfold), so this pages through
// internally and hands callers back the same flat-array shape as before.
interface StandupSummaryPageResponse extends Omit<StandupSummaryDto, 'entries'> {
  entries: PagedResult<StandupEntryDto>;
}

export const checkInKeys = {
  all:     ()                                   => ['checkIns']              as const,
  history: (engineerId?: string, cursor?: string) => ['checkIns', 'history', engineerId, cursor] as const,
  status:  (date?: string)                      => ['checkIns', 'status', date] as const,
  standup: (teamId?: string, date?: string)     => ['checkIns', 'standup', teamId, date] as const,
};

export function useCheckInHistory(engineerId?: string, cursor?: string) {
  return useQuery({
    queryKey: checkInKeys.history(engineerId, cursor),
    queryFn: () =>
      client.get<PagedResult<CheckInDto>>('/check-ins', {
        params: { engineerId, cursor, limit: 20 },
      }).then((r) => r.data),
  });
}

export function useCheckInStatus(date?: string) {
  return useQuery({
    queryKey: checkInKeys.status(date),
    queryFn: () =>
      client.get<{ checkedIn: boolean; missingEngineers: string[] }>('/check-ins/status', {
        params: date ? { date } : undefined,
      }).then((r) => r.data),
  });
}

export function useStandupSummary(teamId?: string, date?: string, enabled = true) {
  return useQuery({
    queryKey: checkInKeys.standup(teamId, date),
    queryFn: async (): Promise<StandupSummaryDto> => {
      const entries: StandupEntryDto[] = [];
      let cursor: string | undefined;
      let page: StandupSummaryPageResponse;
      do {
        page = await client
          .get<StandupSummaryPageResponse>('/check-ins/standup', { params: { teamId, date, limit: 200, cursor } })
          .then((r) => r.data);
        entries.push(...page.entries.items);
        cursor = page.entries.hasMore ? (page.entries.nextCursor ?? undefined) : undefined;
      } while (cursor);
      return { date: page.date, teamId: page.teamId, missingEngineers: page.missingEngineers, entries };
    },
    enabled,
  });
}

/** Blob-download approach (same as downloadPmoCsv/downloadTimeSummaryCsv) — the endpoint needs the
 *  auth header a plain <a href> can't carry. */
export async function downloadStandupSummaryCsv(teamId?: string, date?: string) {
  const response = await client.get('/check-ins/standup/csv', {
    params: { teamId, date },
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `standup-digest-${date ?? 'today'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useSubmitCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { date: string; completed: string; plannedNext: string; blockers?: string; projectId?: string }) =>
      client.post<CheckInDto>('/check-ins', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: checkInKeys.all() }),
  });
}
