import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { UserDto, Role, PagedResult } from '../types/api';

export interface UserListParams {
  cursor?: string;
  role?: string;
  team?: string;
  isActive?: boolean;
  isQa?: boolean;
}

export const userKeys = {
  all:    (params?: UserListParams) => ['users', params] as const,
  detail: (id: string)              => ['users', id]     as const,
};

export interface CreateUserRequest {
  name: string;
  email: string;
  role: Role;
  baselinePoints: number;
  baselineCycleDays: number;
  teamId?: string;
  isQa?: boolean;
  discipline?: string;
}

export interface UpdateUserRequest {
  role?: Role;
  isActive?: boolean;
  unlockAccount?: boolean;
  teamId?: string;
  isQa?: boolean;
  discipline?: string;
}

export function useUserList(params: UserListParams = {}) {
  return useQuery({
    queryKey: userKeys.all(params),
    queryFn:  () =>
      client.get<PagedResult<UserDto>>('/users', { params: { limit: 25, ...params } }).then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserRequest) =>
      client.post<UserDto>('/users', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserRequest) =>
      client.patch<UserDto>(`/users/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (id: string) => client.post(`/users/${id}/resend-invite`),
  });
}

export interface EmailExistsDto {
  email: string;
  exists: boolean;
}

export function useCheckEmailsExist() {
  return useMutation({
    mutationFn: (emails: string[]) =>
      client.post<EmailExistsDto[]>('/users/check-emails', { emails }).then((r) => r.data),
  });
}
