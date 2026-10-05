import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { TeamDto, ThroughputWeekDto } from '../types/api';

export const teamKeys = {
  all:        ()           => ['teams']              as const,
  detail:     (id: string) => ['teams', id]           as const,
  throughput: (id: string) => ['teams', id, 'throughput'] as const,
};

export function useTeamList(enabled = true) {
  return useQuery({
    queryKey: teamKeys.all(),
    queryFn: () => client.get<TeamDto[]>('/teams').then((r) => r.data),
    enabled,
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: teamKeys.detail(id),
    queryFn: () => client.get<TeamDto>(`/teams/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useTeamThroughput(id: string) {
  return useQuery({
    queryKey: teamKeys.throughput(id),
    queryFn: () => client.get<ThroughputWeekDto[]>(`/teams/${id}/throughput`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; teamLeadId?: string; department?: string }) =>
      client.post<TeamDto>('/teams', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all() }),
  });
}

export function useUpdateTeam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; teamLeadId?: string; clearTeamLead?: boolean; deactivate?: boolean; department?: string; clearDepartment?: boolean }) =>
      client.patch<TeamDto>(`/teams/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.detail(id) });
      qc.invalidateQueries({ queryKey: teamKeys.all() });
    },
  });
}
