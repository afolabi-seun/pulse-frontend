import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { projectKeys } from './projects';
import type { ImportResult } from '../types/api';

function uploadCsv(path: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return client
    .post<ImportResult>(path, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
}

function downloadTemplate(path: string, filename: string) {
  return client
    .get(path, { responseType: 'blob', headers: { 'Content-Type': 'text/csv' } })
    .then((r) => {
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
}

export function useImportProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadCsv('/import/projects', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all() }),
  });
}

export function useImportTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadCsv('/import/tasks', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useImportBacklog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadCsv('/import/backlog', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useImportUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadCsv('/import/users', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function downloadProjectsTemplate() {
  return downloadTemplate('/import/template/projects', 'pulse_projects_template.csv');
}

export function downloadTasksTemplate() {
  return downloadTemplate('/import/template/tasks', 'pulse_tasks_template.csv');
}

export function downloadBacklogTemplate() {
  return downloadTemplate('/import/template/backlog', 'pulse_backlog_template.csv');
}

export function downloadUsersTemplate() {
  return downloadTemplate('/import/template/users', 'pulse_users_template.csv');
}
