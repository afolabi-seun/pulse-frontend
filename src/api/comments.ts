import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { CommentDto } from '../types/api';

export const commentKeys = {
  byTask: (taskId: string) => ['comments', taskId] as const,
};

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentKeys.byTask(taskId),
    queryFn: () => client.get<CommentDto[]>(`/tasks/${taskId}/comments`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      client.post<CommentDto>(`/tasks/${taskId}/comments`, { body }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) }),
  });
}

export function useEditComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      client.patch(`/tasks/${taskId}/comments/${commentId}`, { body }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      client.delete(`/tasks/${taskId}/comments/${commentId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) }),
  });
}
