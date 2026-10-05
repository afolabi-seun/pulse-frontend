import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { PerformanceMetricsDto, ProjectPerformanceDto } from '../types/api';

export const performanceKeys = {
  me:      (days: number)                            => ['performance', 'me', days] as const,
  team:    (teamId: string, projectId?: string, days = 30) => ['performance', 'team', teamId, projectId, days] as const,
  project: (projectId: string, days = 30)             => ['performance', 'project', projectId, days] as const,
};

export function useMyPerformance(days = 30, enabled = true) {
  return useQuery({
    queryKey: performanceKeys.me(days),
    queryFn: () => client.get<PerformanceMetricsDto>('/performance/me', { params: { days } }).then((r) => r.data),
    enabled,
  });
}

export function useTeamPerformance(teamId: string, projectId?: string, days = 30) {
  return useQuery({
    queryKey: performanceKeys.team(teamId, projectId, days),
    queryFn: () =>
      client.get<PerformanceMetricsDto[]>(`/performance/team/${teamId}`, { params: { projectId, days } }).then((r) => r.data),
    enabled: !!teamId,
  });
}

export function useProjectPerformance(projectId: string, days = 30) {
  return useQuery({
    queryKey: performanceKeys.project(projectId, days),
    queryFn: () => client.get<ProjectPerformanceDto>(`/performance/project/${projectId}`, { params: { days } }).then((r) => r.data),
    enabled: !!projectId,
  });
}
