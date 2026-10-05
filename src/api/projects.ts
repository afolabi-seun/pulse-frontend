import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { ProjectDto, ThroughputWeekDto, FollowedProjectDto, MyProjectDto, ProjectMemberDto, ProjectActivityDto, PagedResult } from '../types/api';

export const projectKeys = {
  all:        ()          => ['projects']                      as const,
  mine:       ()          => ['projects', 'mine']              as const,
  detail:     (id: string) => ['projects', id]                 as const,
  throughput: (id: string) => ['projects', id, 'throughput']   as const,
  followed:   ()          => ['projects', 'followed']          as const,
  members:    (id: string) => ['projects', id, 'members']      as const,
  activity:   (id: string) => ['projects', id, 'activity']     as const,
};

export function useMyProjects(enabled = true) {
  return useQuery({
    queryKey: projectKeys.mine(),
    queryFn: () => client.get<MyProjectDto[]>('/projects/mine').then((r) => r.data),
    enabled,
  });
}

export function useProjectList(enabled = true) {
  return useQuery({
    queryKey: projectKeys.all(),
    queryFn: () => client.get<ProjectDto[]>('/projects').then((r) => r.data),
    enabled,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => client.get<ProjectDto>(`/projects/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; ownerTeamId: string; code?: string }) =>
      client.post<ProjectDto>('/projects', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all() }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all() }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string; archive?: boolean; ownerTeamId?: string; clearOwnerTeam?: boolean; code?: string }) =>
      client.patch<ProjectDto>(`/projects/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      qc.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
}

export function usePauseProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<ProjectDto>(`/projects/${id}/pause`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      qc.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
}

export function useResumeProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete<ProjectDto>(`/projects/${id}/pause`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      qc.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
}

export function useProjectThroughput(id: string) {
  return useQuery({
    queryKey: projectKeys.throughput(id),
    queryFn: () => client.get<ThroughputWeekDto[]>(`/projects/${id}/throughput`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useProjectActivity(id: string, cursor?: string, limit = 50) {
  return useQuery({
    queryKey: [...projectKeys.activity(id), cursor ?? null] as const,
    queryFn: () => client.get<PagedResult<ProjectActivityDto>>(`/projects/${id}/activity`, { params: { cursor, limit } }).then((r) => r.data),
    enabled: !!id,
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => client.get<ProjectMemberDto[]>(`/projects/${projectId}/members`).then((r) => r.data),
    enabled: !!projectId,
  });
}


export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (engineerId: string) =>
      client.post<ProjectMemberDto[]>(`/projects/${projectId}/members`, { engineerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (engineerId: string) =>
      client.delete<ProjectMemberDto[]>(`/projects/${projectId}/members/${engineerId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useAddProjectTeam(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      client.post<ProjectMemberDto[]>(`/projects/${projectId}/members/team`, { teamId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useFollowedProjects(enabled = true) {
  return useQuery({
    queryKey: projectKeys.followed(),
    queryFn: () => client.get<FollowedProjectDto[]>('/projects/followed').then((r) => r.data),
    enabled,
  });
}

export function useFollowProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.post<boolean>(`/projects/${id}/follow`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.followed() }),
  });
}

export function useUnfollowProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<boolean>(`/projects/${id}/follow`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.followed() }),
  });
}
