import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { ThresholdsDto, DepartmentThresholdDto } from '../types/api';

export const thresholdKeys = {
  current: () => ['thresholds'] as const,
  departments: () => ['thresholds', 'departments'] as const,
};

export function useThresholds(enabled = true) {
  return useQuery({
    queryKey: thresholdKeys.current(),
    queryFn: () => client.get<ThresholdsDto>('/thresholds').then((r) => r.data),
    enabled,
  });
}

export function useUpdateThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ThresholdsDto>) =>
      client.patch<ThresholdsDto>('/thresholds', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thresholdKeys.current() });
      qc.invalidateQueries({ queryKey: ['meta'] });
    },
  });
}

export function useDepartmentThresholds() {
  return useQuery({
    queryKey: thresholdKeys.departments(),
    queryFn: () => client.get<DepartmentThresholdDto[]>('/thresholds/departments').then((r) => r.data),
  });
}

type DepartmentThresholdOverrideInput = {
  loadVsBaselineRatio?: number | null;
  maxConcurrentTasks?: number | null;
  staleCycleMultiplier?: number | null;
  signalsRequiredToFlag?: number | null;
};

export function useUpsertDepartmentThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ department, ...body }: DepartmentThresholdOverrideInput & { department: string }) =>
      client.put<DepartmentThresholdDto>(`/thresholds/departments/${encodeURIComponent(department)}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: thresholdKeys.departments() }),
  });
}

export function useDeleteDepartmentThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (department: string) =>
      client.delete(`/thresholds/departments/${encodeURIComponent(department)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: thresholdKeys.departments() }),
  });
}
