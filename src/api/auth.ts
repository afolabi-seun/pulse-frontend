import { useMutation } from '@tanstack/react-query';
import client from './client';
import type { AuthDto } from '../types/api';

async function login(email: string, password: string): Promise<AuthDto> {
  return client.post<AuthDto>('/auth/login', { email, password }).then((r) => r.data);
}

async function logout(refreshToken: string): Promise<void> {
  await client.post('/auth/logout', { refreshToken });
}

async function bootstrap(name: string, email: string, password: string): Promise<AuthDto> {
  return client.post<AuthDto>('/auth/bootstrap', { name, email, password }).then((r) => r.data);
}

async function requestPasswordReset(email: string): Promise<void> {
  await client.post('/auth/password-reset', { email });
}

async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await client.post('/auth/password-reset/confirm', { token, newPassword });
}

export function useLogin() {
  return useMutation({ mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password) });
}

export function useLogout() {
  return useMutation({ mutationFn: (refreshToken: string) => logout(refreshToken) });
}

export function useBootstrap() {
  return useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) =>
      bootstrap(name, email, password),
  });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => requestPasswordReset(email) });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      confirmPasswordReset(token, newPassword),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      client.post('/auth/change-password', { currentPassword, newPassword }),
  });
}
