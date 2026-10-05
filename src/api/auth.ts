import { useMutation } from '@tanstack/react-query';
import client from './client';
import { authCookieConfig } from '../lib/auth';
import type { AuthDto } from '../types/api';

async function login(email: string, password: string): Promise<AuthDto> {
  // useCookie: the refresh token comes back only as an httpOnly cookie, never in the response body.
  return client.post<AuthDto>('/auth/login', { email, password, useCookie: true }, authCookieConfig).then((r) => r.data);
}

async function logout(): Promise<void> {
  await client.post('/auth/logout', {}, authCookieConfig);
}

async function bootstrap(name: string, email: string, password: string): Promise<AuthDto> {
  return client.post<AuthDto>('/auth/bootstrap', { name, email, password, useCookie: true }, authCookieConfig).then((r) => r.data);
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
  return useMutation({ mutationFn: () => logout() });
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
