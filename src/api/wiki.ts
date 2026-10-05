import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type {
  WikiPageSummaryDto, WikiPageDto,
  WikiPageRevisionDto, WikiPageRevisionContentDto,
  WikiIndexEntryDto, PagedResult,
} from '../types/api';

// The backend now serves both wiki listings as a bounded, cursor-paginated endpoint (so a single
// request can never pull an unbounded number of rows), but every consumer here — link resolution
// in WikiContent, and the search/sort/group UI on the index pages — needs the complete set. So
// these two hooks page through the endpoint internally, a generous LIMIT per round trip apart,
// and still hand callers back one plain array, exactly as before.
const FETCH_ALL_PAGE_SIZE = 200;

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await client
      .get<PagedResult<T>>(url, { params: { limit: FETCH_ALL_PAGE_SIZE, cursor } })
      .then((r) => r.data);
    items.push(...page.items);
    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return items;
}

const keys = {
  list: (projectId: string) => ['wiki', projectId] as const,
  page: (projectId: string, pageId: string) => ['wiki', projectId, pageId] as const,
  revisions: (projectId: string, pageId: string) => ['wiki', projectId, pageId, 'revisions'] as const,
  revision: (projectId: string, pageId: string, revId: string) => ['wiki', projectId, pageId, 'revisions', revId] as const,
  all: () => ['wiki', 'all'] as const,
};

export function useWikiPages(projectId: string) {
  return useQuery({
    queryKey: keys.list(projectId),
    queryFn: () => fetchAllPages<WikiPageSummaryDto>(`/projects/${projectId}/wiki`),
    enabled: !!projectId,
  });
}

export function useWikiPage(projectId: string, pageId: string | null) {
  return useQuery({
    queryKey: keys.page(projectId, pageId ?? ''),
    queryFn: () =>
      client.get<WikiPageDto>(`/projects/${projectId}/wiki/${pageId}`).then((r) => r.data),
    enabled: !!projectId && !!pageId,
  });
}

export function useCreateWikiPage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string; restrictedToMembers?: boolean }) =>
      client.post<WikiPageDto>(`/projects/${projectId}/wiki`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.list(projectId) });
      // The org-wide index backs WikiContent's cross-project link resolver (useAllWikiPages) —
      // without this, a page just created here stays invisible to links on other pages until
      // that cache happens to expire on its own.
      qc.invalidateQueries({ queryKey: keys.all() });
    },
  });
}

export function useUpdateWikiPage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, ...data }: { pageId: string; title: string; content: string; restrictedToMembers?: boolean }) =>
      client.put<WikiPageDto>(`/projects/${projectId}/wiki/${pageId}`, data).then((r) => r.data),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: keys.list(projectId) });
      qc.setQueryData(keys.page(projectId, page.id), page);
      // A title change must propagate here too — the org-wide index otherwise keeps resolving
      // links against the page's old title.
      qc.invalidateQueries({ queryKey: keys.all() });
    },
  });
}

export function useDeleteWikiPage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) =>
      client.delete(`/projects/${projectId}/wiki/${pageId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.list(projectId) });
      qc.invalidateQueries({ queryKey: keys.all() });
    },
  });
}

export function useWikiRevisions(projectId: string, pageId: string | null) {
  return useQuery({
    queryKey: keys.revisions(projectId, pageId ?? ''),
    queryFn: () =>
      client.get<WikiPageRevisionDto[]>(`/projects/${projectId}/wiki/${pageId}/revisions`).then((r) => r.data),
    enabled: !!projectId && !!pageId,
  });
}

export function useWikiRevision(projectId: string, pageId: string | null, revisionId: string | null) {
  return useQuery({
    queryKey: keys.revision(projectId, pageId ?? '', revisionId ?? ''),
    queryFn: () =>
      client.get<WikiPageRevisionContentDto>(`/projects/${projectId}/wiki/${pageId}/revisions/${revisionId}`).then((r) => r.data),
    enabled: !!projectId && !!pageId && !!revisionId,
  });
}

export function useAllWikiPages(enabled = true) {
  return useQuery({
    queryKey: keys.all(),
    queryFn: () => fetchAllPages<WikiIndexEntryDto>('/wiki'),
    staleTime: 60_000,
    enabled,
  });
}

export async function downloadWikiPagePdf(projectId: string, pageId: string, title: string) {
  const response = await client.get(`/projects/${projectId}/wiki/${pageId}/pdf`, {
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  a.download = `${slug || 'wiki-page'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
