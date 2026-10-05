import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { FeedbackDto, FeedbackPatternsDto } from '../types/api';

export const feedbackKeys = {
  all:      () => ['feedback']          as const,
  list:     () => ['feedback', 'list']  as const,
  patterns: () => ['feedback', 'patterns'] as const,
};

export function useFeedbackList() {
  return useQuery({
    queryKey: feedbackKeys.list(),
    queryFn: () => client.get<FeedbackDto[]>('/feedback').then((r) => r.data),
  });
}

/** The patterns endpoint used to return a bare list of weeks; it now returns an object with the weeks plus how many
 * were hidden, who could have taken part and the scope. A frontend served against a backend that hasn't been updated
 * yet (or the reverse, briefly, during a deploy) must not crash on the older shape, so accept both. */
export function normalizeFeedbackPatterns(raw: unknown): FeedbackPatternsDto {
  if (Array.isArray(raw))
    return { weeks: raw as FeedbackPatternsDto['weeks'], hiddenWeeks: 0, eligiblePeople: 0, scope: 'Organisation' };
  const o = (raw ?? {}) as Partial<FeedbackPatternsDto>;
  return {
    weeks: Array.isArray(o.weeks) ? o.weeks : [],
    hiddenWeeks: o.hiddenWeeks ?? 0,
    eligiblePeople: o.eligiblePeople ?? 0,
    scope: o.scope ?? 'Organisation',
  };
}

export function useFeedbackPatterns() {
  return useQuery({
    queryKey: feedbackKeys.patterns(),
    queryFn: () => client.get<unknown>('/feedback/patterns').then((r) => normalizeFeedbackPatterns(r.data)),
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { text: string; taskId?: string }) =>
      client.post<FeedbackDto>('/feedback', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all() }),
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/feedback/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all() }),
  });
}

export function useReplyToFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      client.post<FeedbackDto>(`/feedback/${id}/reply`, { text }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all() }),
  });
}
