import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { EpicDto } from '../types/api';

export const epicKeys = {
  byProject:  (projectId: string) => ['epics', 'project', projectId] as const,
  backlog:    (projectId: string) => ['epics', 'backlog', projectId] as const,
  detail:     (id: string)        => ['epics', id]                   as const,
};

export function useEpicsByProject(projectId: string) {
  return useQuery({
    queryKey: epicKeys.byProject(projectId),
    queryFn:  () => client.get<EpicDto[]>('/epics', { params: { projectId } }).then((r) => r.data),
    enabled:  !!projectId,
  });
}

export function useBacklogEpics(projectId: string) {
  return useQuery({
    queryKey: epicKeys.backlog(projectId),
    queryFn:  () => client.get<EpicDto[]>('/epics', { params: { projectId, backlogOnly: true } }).then((r) => r.data),
    enabled:  !!projectId,
  });
}

export function useEpic(id: string) {
  return useQuery({
    queryKey: epicKeys.detail(id),
    queryFn:  () => client.get<EpicDto>(`/epics/${id}`).then((r) => r.data),
    enabled:  !!id,
  });
}

export function useCreateEpic(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; acceptanceCriteria?: string; order?: number }) =>
      client.post<EpicDto>('/epics', { ...body, projectId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: epicKeys.byProject(projectId) });
      qc.invalidateQueries({ queryKey: epicKeys.backlog(projectId) });
    },
  });
}

export function useUpdateEpic(id: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title?: string;
      description?: string;
      acceptanceCriteria?: string;
      status?: string;
      order?: number;
      sprintId?: string;
      removeFromSprint?: boolean;
    }) => client.patch<EpicDto>(`/epics/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: epicKeys.detail(id) });
      qc.invalidateQueries({ queryKey: epicKeys.byProject(projectId) });
      qc.invalidateQueries({ queryKey: epicKeys.backlog(projectId) });
    },
  });
}

export function useDeleteEpic(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/epics/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: epicKeys.byProject(projectId) });
      qc.invalidateQueries({ queryKey: epicKeys.backlog(projectId) });
    },
  });
}
