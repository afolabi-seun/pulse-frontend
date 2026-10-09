import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export interface ArchiveTaskLine {
  id: string;
  key: string;
  title: string;
  status: string;
  assigneeName: string | null;
  projectName: string;
}

export interface ArchiveProjectSummary {
  projectId: string;
  projectName: string;
  total: number;
  backlog: number;
  active: number;
  blocked: number;
  inQa: number;
  paused: number;
  done: number;
}

export interface ArchiveTasksResult {
  dryRun: boolean;
  baselineStart: string;
  toArchive: number;
  open: number;
  done: number;
  keptBecauseTouched: number;
  projects: ArchiveProjectSummary[];
  openTasks: ArchiveTaskLine[];
  openTasksTruncated: boolean;
  keptTasks: ArchiveTaskLine[];
  keptTasksTruncated: boolean;
}

export interface ArchiveTasksRequest {
  baselineStart: string;
  projectIds?: string[];
  includeTouched: boolean;
  dryRun: boolean;
  reason?: string;
  /** Minutes from UTC of the local time the baseline day starts in (the admin's own browser). */
  utcOffsetMinutes?: number;
}

export interface ArchivedTaskDto {
  id: string;
  key: string;
  title: string;
  status: string;
  projectId: string;
  projectName: string;
  assigneeName: string | null;
  isQaTask: boolean;
  archivedAt: string;
  archivedByName: string | null;
  reason: string | null;
}

export interface ArchivedTaskPage {
  items: ArchivedTaskDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const archiveKeys = {
  all: () => ['task-archive'] as const,
  list: (p: { projectId?: string; search?: string; page: number }) => ['task-archive', 'list', p] as const,
};

export function useArchivedTasks(params: { projectId?: string; search?: string; page: number }) {
  return useQuery({
    queryKey: archiveKeys.list(params),
    queryFn: () => client.get<ArchivedTaskPage>('/tasks/archived', { params: { ...params, pageSize: 25 } }).then((r) => r.data),
  });
}

/** Preview (dryRun) or perform the archive. Not cached: every call is a deliberate action. */
export function useArchiveTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ArchiveTasksRequest) => client.post<ArchiveTasksResult>('/tasks/archive', body).then((r) => r.data),
    onSuccess: (result) => {
      if (!result.dryRun) {
        qc.invalidateQueries({ queryKey: archiveKeys.all() });
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

export function useRestoreArchivedTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.post<number>(`/tasks/${id}/restore`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.all() });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
