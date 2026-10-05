import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { SprintDto, SprintVelocityDto, BurndownPointDto, RetroDto } from '../types/api';

export const sprintKeys = {
  all:       ()               => ['sprints']                      as const,
  list:      (teamId?: string, projectId?: string) => ['sprints', 'list', teamId ?? null, projectId ?? null] as const,
  detail:    (id: string)     => ['sprints', id]                  as const,
  velocity:  (id: string)     => ['sprints', id, 'velocity']      as const,
  burndown:  (id: string)     => ['sprints', id, 'burndown']      as const,
  retro:     (id: string)     => ['sprints', id, 'retrospective'] as const,
};

export function useSprintList(teamId?: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: sprintKeys.list(teamId, projectId),
    queryFn: () =>
      client
        .get<SprintDto[]>('/sprints', { params: { teamId, projectId } })
        .then((r) => r.data),
    enabled,
  });
}

export function useSprint(id: string) {
  return useQuery({
    queryKey: sprintKeys.detail(id),
    queryFn: () => client.get<SprintDto>(`/sprints/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useSprintVelocity(id: string) {
  return useQuery({
    queryKey: sprintKeys.velocity(id),
    queryFn: () =>
      client.get<SprintVelocityDto>(`/sprints/${id}/velocity`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useSprintBurndown(id: string) {
  return useQuery({
    queryKey: sprintKeys.burndown(id),
    queryFn: () =>
      client.get<BurndownPointDto[]>(`/sprints/${id}/burndown`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useSprintRetro(id: string) {
  return useQuery({
    queryKey: sprintKeys.retro(id),
    queryFn: () =>
      client.get<RetroDto | null>(`/sprints/${id}/retrospective`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpsertRetro(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { wentWell: string; needsImprovement: string; actionItems: string }) =>
      client.put<RetroDto>(`/sprints/${id}/retrospective`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sprintKeys.retro(id) }),
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      projectId: string;
      name: string;
      goal?: string;
      startDate: string;
      endDate: string;
    }) => client.post<SprintDto>('/sprints', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sprintKeys.all() }),
  });
}

export function useUpdateSprint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
      activate?: boolean;
      complete?: boolean;
      capacityPoints?: number;
      showAndTellDate?: string;
      showAndTellNotes?: string;
      dueDateChangeReason?: string;
    }) => client.patch<SprintDto>(`/sprints/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.detail(id) });
      qc.invalidateQueries({ queryKey: sprintKeys.all() });
    },
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/sprints/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sprintKeys.all() }),
  });
}
