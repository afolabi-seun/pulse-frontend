import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { VitalsResponseDto } from '../types/api';

export const vitalsKeys = {
  all:      () => ['vitals']                       as const,
  list:     () => ['vitals', 'list']               as const,
  team:     (weekOf?: string) => ['vitals', 'team', weekOf ?? null] as const,
};

// /vitals/me is the caller's own history. GET /vitals (bare, useTeamVitalsList below) is a
// different, broader endpoint — every engineer's responses a head/PMO/HR can see — and must not be
// confused with this one: VitalsPage's own-week lookup has no engineerId filter, so calling the
// bare endpoint here would let it pick up a different engineer's score/comment entirely.
export function useVitalsList() {
  return useQuery({
    queryKey: vitalsKeys.list(),
    queryFn: () => client.get<VitalsResponseDto[]>('/vitals/me').then((r) => r.data),
  });
}

/** Every engineer's vitals response for one week (ListVitalsQuery) — a department head's own
 * department, or org-wide for PMO/Head of Product/HR. Scoped to weekOf (a snapshot of "this
 * week", not an ever-growing full history) since the viewer here is one person looking at many
 * engineers, not an individual looking back at their own handful of past weeks. Powers
 * VitalsDigestPage, whose route is already capability-gated to match this endpoint. */
export function useTeamVitalsList(weekOf: string) {
  return useQuery({
    queryKey: vitalsKeys.team(weekOf),
    queryFn: () => client.get<VitalsResponseDto[]>('/vitals', { params: { weekOf } }).then((r) => r.data),
  });
}

export function scoreBadgeClass(score: number): string {
  return score >= 4 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    : score >= 3   ? 'bg-primary/10 text-primary'
                   : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40';
}

export function useSubmitVitals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { score: number; comment?: string }) =>
      client.post<VitalsResponseDto>('/vitals', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: vitalsKeys.all() }),
  });
}

export function useDeleteVitals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/vitals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: vitalsKeys.all() }),
  });
}
