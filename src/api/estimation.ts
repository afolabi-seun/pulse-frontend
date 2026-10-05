import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { EstimationDto } from '../types/api';

export const estimationKeys = {
  byTask: (taskId: string) => ['estimation', taskId] as const,
};

export function useEstimation(taskId: string) {
  return useQuery({
    queryKey: estimationKeys.byTask(taskId),
    queryFn: () => client.get<EstimationDto>(`/tasks/${taskId}/estimation`).then((r) => r.data),
    enabled: !!taskId,
    refetchInterval: 5000,
  });
}

export function useSubmitVote(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (points: number) =>
      client.post(`/tasks/${taskId}/estimation/vote`, { points }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: estimationKeys.byTask(taskId) }),
  });
}

export function useRevealCards(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post(`/tasks/${taskId}/estimation/reveal`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: estimationKeys.byTask(taskId) }),
  });
}

export function useSubmitEstimateForApproval(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (points: number) =>
      client.post(`/tasks/${taskId}/estimation/submit-for-approval`, { points }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: estimationKeys.byTask(taskId) }),
  });
}

export function useApproveEstimate(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post(`/tasks/${taskId}/estimation/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: estimationKeys.byTask(taskId) });
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
    },
  });
}

export function useRejectEstimate(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      client.post(`/tasks/${taskId}/estimation/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: estimationKeys.byTask(taskId) }),
  });
}

export function useResetEstimation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete(`/tasks/${taskId}/estimation`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: estimationKeys.byTask(taskId) }),
  });
}
