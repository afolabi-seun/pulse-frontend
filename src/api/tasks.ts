import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import client from './client';
import type { TaskDto, TaskDependencyDto, TaskLinksDto, SubtaskDto, PagedResult, PreviewAssignResult, BulkReassignResult, BulkCreateTasksResult, EngineerDto } from '../types/api';

export interface TaskListParams {
  projectId?: string;
  assigneeId?: string;
  status?: string;
  taskType?: string;
  sprintId?: string;
  epicId?: string;
  noSprint?: boolean;
  title?: string;
  discipline?: string;
  limit?: number;
  cursor?: string;
  excludeDone?: boolean;
  noAssignee?: boolean;
  sortBy?: 'title' | 'status' | 'dueDate' | 'actualEndDate' | 'points';
  sortDirection?: 'asc' | 'desc';
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  points?: number;
  dueDate?: string;
  /** Omitted when `personal` is true — the server files the task in the caller's own personal project. */
  projectId?: string;
  /** HR/Accountant only: a private to-do in the caller's own personal project. */
  personal?: boolean;
  assigneeId?: string;
  type?: string;
  epicId?: string;
  requiresQa?: boolean;
  discipline?: string;
  requiresFrontendHandoff?: boolean;
  parentTaskId?: string;
  priority?: number;
  externalReference?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  severity?: string;
  epicId?: string;
  removeFromEpic?: boolean;
  points?: number;
  dueDate?: string;
  actualEndDate?: string | null;
  assigneeId?: string;
  type?: string;
  status?: string;
  sprintId?: string;
  removeFromSprint?: boolean;
  markDone?: boolean;
  requiresQa?: boolean;
  discipline?: string;
  requiresFrontendHandoff?: boolean;
  priority?: number;
  removePriority?: boolean;
  externalReference?: string;
  removeExternalReference?: boolean;
  requiresPrApproval?: boolean;
  /** Required by the API when an existing due date is changed. */
  dueDateChangeReason?: string;
  /** Required by the API when the estimate of a task that has been started is changed. */
  pointsChangeReason?: string;
}

export const taskKeys = {
  all:               ()                        => ['tasks']                            as const,
  list:              (p: TaskListParams)       => ['tasks', 'list', p]                 as const,
  detail:            (id: string)              => ['tasks', id]                        as const,
  dependencies:      (id: string)              => ['tasks', id, 'dependencies']        as const,
  subtasks:          (id: string)              => ['tasks', id, 'subtasks']            as const,
  mentionCandidates: (id: string)              => ['tasks', id, 'mention-candidates']  as const,
  handoffCandidates: (id: string, d: string)   => ['tasks', id, 'handoff-candidates', d] as const,
  qaSendCandidates:  (id: string)              => ['tasks', id, 'qa-send-candidates']    as const,
};

export function useTaskList(params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => client.get<PagedResult<TaskDto>>('/tasks', { params }).then((r) => r.data),
    enabled,
  });
}

/** Task lists come back at most 100 at a time. This loads them page by page, for a view that lets the reader ask for more. */
export function useInfiniteTaskList(params: Omit<TaskListParams, 'cursor'>, enabled = true) {
  const query = useInfiniteQuery({
    // Under the 'tasks' key so any task change refetches it, like every other task list.
    queryKey: ['tasks', 'infinite', params] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client.get<PagedResult<TaskDto>>('/tasks', { params: { ...params, cursor: pageParam } }).then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    enabled,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return { ...query, items };
}

/** Pages loaded automatically before giving up; 20 × 100 tasks is far beyond any epic or sprint. */
const MAX_AUTO_PAGES = 20;

/** Every task matching the filter, not just the first 100 — for totals and progress, which are wrong if computed
 * from a list that was quietly cut short. Keeps fetching pages until there are none left. */
export function useAllTasks(params: Omit<TaskListParams, 'cursor'>, enabled = true) {
  const { items, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage, data } = useInfiniteTaskList(params, enabled);
  const pageCount = data?.pages.length ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && pageCount < MAX_AUTO_PAGES) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, pageCount, fetchNextPage]);
  return {
    items,
    isLoading,
    error,
    refetch,
    /** True only if there were more than MAX_AUTO_PAGES pages, so the totals are still incomplete. */
    truncated: !!hasNextPage && pageCount >= MAX_AUTO_PAGES,
  };
}

export function useQaQueue(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['tasks', 'qa-queue'] as const,
    queryFn: () => client.get<TaskDto[]>('/tasks/qa-queue').then((r) => r.data),
    enabled: options.enabled ?? true,
  });
}

// Tasks the caller most recently did backend work on that are no longer assigned to them —
// handed off to Frontend and not yet handed back — so their finished work stays visible even
// though the task's current assignee has moved on.
export function useMyFrontendHandoffs(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['tasks', 'my-frontend-handoffs'] as const,
    queryFn: () => client.get<TaskDto[]>('/tasks/my-frontend-handoffs').then((r) => r.data),
    enabled: options.enabled ?? true,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => client.get<TaskDto>(`/tasks/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

/** Everyone mentionable in this task's comments and blocker reason — everyone who can access its
 * project (PM+/global roles, members, task assignees, the owning team, a matching department
 * head), plus the task's own creator. Task-scoped rather than project-scoped specifically so the
 * creator — who may have no other standing access — is always included. */
export function useTaskMentionCandidates(taskId: string) {
  return useQuery({
    queryKey: taskKeys.mentionCandidates(taskId),
    queryFn: () => client.get<EngineerDto[]>(`/tasks/${taskId}/mention-candidates`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTaskRequest) => client.post<TaskDto>('/tasks', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTaskRequest) => client.patch<TaskDto>(`/tasks/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export type BoardStatusChangeVars =
  | { taskId: string; action: 'mark-done' }
  | { taskId: string; action: 'clear-blocker' }
  | { taskId: string; action: 'flag-blocker-with-reason'; reason: string }
  | { taskId: string; action: 'send-to-qa' }
  | { taskId: string; action: 'reject-qa-with-reason'; reason: string };

// Routes a board drag-and-drop to the same narrowly-scoped endpoints TaskDetailPage's action
// buttons use (mark-done / blocker), instead of the PM-only generic PATCH — those endpoints
// already allow the assignee or anyone with project access (team leads included).
export function useBoardStatusChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: BoardStatusChangeVars) => {
      switch (vars.action) {
        case 'mark-done':
          return client.post<TaskDto>(`/tasks/${vars.taskId}/mark-done`).then((r) => r.data);
        case 'clear-blocker':
          return client.delete<TaskDto>(`/tasks/${vars.taskId}/blocker`).then((r) => r.data);
        case 'flag-blocker-with-reason':
          return client.post<TaskDto>(`/tasks/${vars.taskId}/blocker`, { reason: vars.reason }).then((r) => r.data);
        case 'send-to-qa':
          return client.post<TaskDto>(`/tasks/${vars.taskId}/send-to-qa`).then((r) => r.data);
        case 'reject-qa-with-reason':
          return client.post<TaskDto>(`/tasks/${vars.taskId}/propose-qa-rejection`, { reason: vars.reason }).then((r) => r.data);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useAssignTasksToSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds, sprintId }: { taskIds: string[]; sprintId: string }) =>
      Promise.all(taskIds.map((id) => client.patch<TaskDto>(`/tasks/${id}`, { sprintId }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useFlagBlocker(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => client.post<TaskDto>(`/tasks/${taskId}/blocker`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useClearBlocker(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete<TaskDto>(`/tasks/${taskId}/blocker`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function usePauseTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => client.post<TaskDto>(`/tasks/${taskId}/pause`, { note }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useResumeTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete<TaskDto>(`/tasks/${taskId}/pause`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useReturnTaskToBacklog(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${taskId}/return-to-backlog`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function usePreviewAssign(taskId: string) {
  return useMutation({
    mutationFn: (assigneeId: string) =>
      client.post<PreviewAssignResult>(`/tasks/${taskId}/preview-assign`, { assigneeId }).then((r) => r.data),
  });
}

export function useBulkReassign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { taskIds: string[]; targetEngineerId: string }) =>
      client.post<BulkReassignResult>('/tasks/bulk-reassign', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useBulkStatusChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { taskIds: string[]; targetStatus: 'done' | 'active' }) =>
      client.post<number>('/tasks/bulk-status', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export interface BulkCreateTaskItem {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  points?: number;
  dueDate?: string;
  assigneeId?: string;
  type?: string;
}

export function useBulkCreateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { projectId: string; tasks: BulkCreateTaskItem[] }) =>
      client.post<BulkCreateTasksResult>('/tasks/bulk', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useTaskDependencies(taskId: string) {
  return useQuery({
    queryKey: taskKeys.dependencies(taskId),
    queryFn: () => client.get<TaskLinksDto>(`/tasks/${taskId}/dependencies`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useAddDependency(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockingTaskId: string) =>
      client.post<TaskDependencyDto>(`/tasks/${taskId}/dependencies`, { blockingTaskId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) });
    },
  });
}

export function useRemoveDependency(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockingTaskId: string) =>
      client.delete(`/tasks/${taskId}/dependencies/${blockingTaskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) });
    },
  });
}

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: taskKeys.subtasks(taskId),
    queryFn: () => client.get<SubtaskDto[]>(`/tasks/${taskId}/subtasks`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useAddSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      client.post<SubtaskDto>(`/tasks/${taskId}/subtasks`, { title }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) }),
  });
}

export function useToggleSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subtaskId, isDone }: { subtaskId: string; isDone: boolean }) =>
      client.patch<SubtaskDto>(`/tasks/${taskId}/subtasks/${subtaskId}`, { isDone }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) }),
  });
}

export function useDeleteSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) => client.delete(`/tasks/${taskId}/subtasks/${subtaskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) }),
  });
}

export function useLoanSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subtaskId, targetEngineerId, reason }: { subtaskId: string; targetEngineerId: string; reason?: string }) =>
      client.post<SubtaskDto>(`/tasks/${taskId}/subtasks/${subtaskId}/loan`, { targetEngineerId, reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) }),
  });
}

export function useRecallSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) =>
      client.post<SubtaskDto>(`/tasks/${taskId}/subtasks/${subtaskId}/recall`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) }),
  });
}

/** Claims an unassigned task for an engineer. A Team Lead may only target an engineer on the
 * team they lead; PM-or-above roles are unrestricted — see AssignTaskCommand. */
export function useAssignTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { assigneeId: string }) =>
      client.post<TaskDto>(`/tasks/${taskId}/assign`, body).then((r) => r.data),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useLoanTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { targetEngineerId: string; reason?: string }) =>
      client.post<TaskDto>(`/tasks/${taskId}/loan`, body).then((r) => r.data),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useRecallTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${taskId}/recall`).then((r) => r.data),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useMarkTaskDone(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${taskId}/mark-done`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useGroomOwnTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { points: number; priority?: number }) =>
      client.patch<TaskDto>(`/tasks/${taskId}/groom`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useAssigneeEditTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { description?: string; dueDate?: string; dueDateChangeReason?: string }) =>
      client.patch<TaskDto>(`/tasks/${taskId}/assignee-edit`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

/** Omit qaEngineerId (or pass undefined) to keep the automatic reviewer pick. */
/** For a task stuck In QA because its QA task was deleted: returns it to Active so it can be sent to QA again. */
export function useRecoverMissingQa(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${taskId}/recover-missing-qa`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useSendToQa(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (qaEngineerId?: string) =>
      client.post<TaskDto>(`/tasks/${taskId}/send-to-qa`, { qaEngineerId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export interface QaSendCandidate { id: string; name: string; discipline: string | null; onProject: boolean; }
export interface QaSendCandidates { candidates: QaSendCandidate[]; recommendedEngineerId: string | null; }

/** Active QA engineers this task can be sent to, plus who the automatic pick would choose —
 *  backs the "Send to QA" reviewer picker. Open to the task's own assignee, unlike the
 *  PM-only /engineers/qa-candidates roster. */
export function useQaSendCandidates(taskId: string, enabled = true) {
  return useQuery({
    queryKey: taskKeys.qaSendCandidates(taskId),
    queryFn: () => client.get<QaSendCandidates>(`/tasks/${taskId}/qa-send-candidates`).then((r) => r.data),
    enabled: enabled && !!taskId,
  });
}

export function useRequestPrApproval(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prLink: string) => client.post<TaskDto>(`/tasks/${taskId}/pr-approval/request`, { prLink }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useApprovePrApproval(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${taskId}/pr-approval/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useRejectPrApproval(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => client.post<TaskDto>(`/tasks/${taskId}/pr-approval/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useReassignPrApprover(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (approverId: string) => client.post<TaskDto>(`/tasks/${taskId}/pr-approval/reassign`, { approverId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export interface HandoffCandidate { id: string; name: string; discipline: string | null; onProject: boolean; }

/** Every active engineer with the given discipline (the project's own first) — the Backend ↔ Frontend
 *  hand-off picker. Open to the task's own assignee, unlike the PMO-only project-assignable roster. */
export function useHandoffCandidates(taskId: string, discipline: 'frontend' | 'backend', enabled = true) {
  return useQuery({
    queryKey: taskKeys.handoffCandidates(taskId, discipline),
    queryFn: () => client
      .get<HandoffCandidate[]>(`/tasks/${taskId}/handoff-candidates`, { params: { discipline } })
      .then((r) => r.data),
    enabled: enabled && !!taskId,
  });
}

export function useHandOffToFrontend(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frontendAssigneeId: string) =>
      client.post<TaskDto>(`/tasks/${taskId}/hand-off-to-frontend`, { frontendAssigneeId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

/** The reverse of useHandOffToFrontend — sends a task back to a backend developer, e.g. after
 * picking the wrong frontend engineer. */
export function useHandOffToBackend(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (backendAssigneeId: string) =>
      client.post<TaskDto>(`/tasks/${taskId}/hand-off-to-backend`, { backendAssigneeId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

// Flags a problem with a QA review — the original task stays in QA and nothing about its status
// changes until confirmed or withdrawn (see useConfirmQaRejection/useWithdrawQaRejection). Called
// on the QA sub-task's id, same as the other QA-review actions.
export function useProposeQaRejection(qaTaskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; targetStage?: 'frontend' | 'backend' }) =>
      client.post<TaskDto>(`/tasks/${qaTaskId}/propose-qa-rejection`, input).then((r) => r.data),
    onSuccess: (parentTask) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(qaTaskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(parentTask.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

// QA confirms a proposed rejection stands — this is the point an iteration actually counts.
export function useConfirmQaRejection(qaTaskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${qaTaskId}/confirm-qa-rejection`).then((r) => r.data),
    onSuccess: (parentTask) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(qaTaskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(parentTask.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

// QA drops a proposed rejection — the task stays exactly where it was, no iteration counted.
export function useWithdrawQaRejection(qaTaskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<TaskDto>(`/tasks/${qaTaskId}/withdraw-qa-rejection`).then((r) => r.data),
    onSuccess: (parentTask) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(qaTaskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(parentTask.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

// The assignee's reply to a pending QA rejection — called on the original task, not the sub-task.
export function useRespondToQaRejection(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (response: string) =>
      client.post<TaskDto>(`/tasks/${taskId}/respond-to-qa-rejection`, { response }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}
