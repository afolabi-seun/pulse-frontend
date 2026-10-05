import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Download, Lock, Search } from 'lucide-react';
import { useAllWikiPages, downloadWikiPagePdf } from '../../api/wiki';
import { useSessionState } from '../../hooks/useSessionState';
import PageHeader from '../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '../../components/ui/Pagination';
import { cn } from '@/lib/utils';
import type { WikiIndexEntryDto } from '../../types/api';

const PAGE_SIZE = 25;

type SortKey = 'updated' | 'title' | 'project';
type View = 'grouped' | 'list';

const touched = (e: WikiIndexEntryDto) => e.updatedAt ?? e.createdAt;

const SORTERS: Record<SortKey, (a: WikiIndexEntryDto, b: WikiIndexEntryDto) => number> = {
  updated: (a, b) => touched(b).localeCompare(touched(a)),
  title:   (a, b) => a.pageTitle.localeCompare(b.pageTitle),
  project: (a, b) => a.projectName.localeCompare(b.projectName) || a.pageTitle.localeCompare(b.pageTitle),
};

const readView = (): View => {
  try { return localStorage.getItem('wiki.view') === 'list' ? 'list' : 'grouped'; } catch { return 'grouped'; }
};

export default function WikiIndexPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAllWikiPages();
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [view, setViewState] = useState<View>(readView);
  // Project ids the reader has folded away; survives going to a page and coming back.
  const [collapsed, setCollapsed] = useSessionState<string[]>('wiki.collapsed', []);
  const [pageIndex, setPageIndex] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem('wiki.view', v); } catch { /* best-effort only */ }
  };

  const projects = useMemo(() => {
    const byId = new Map<string, string>();
    (data ?? []).forEach((e) => byId.set(e.projectId, e.projectName));
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => (data ?? [])
      .filter((e) => (!projectId || e.projectId === projectId)
        && (!q || e.pageTitle.toLowerCase().includes(q) || e.projectName.toLowerCase().includes(q)))
      .sort(SORTERS[sortKey]),
    [data, projectId, q, sortKey],
  );

  const groups = useMemo(() => {
    const byProject = new Map<string, { projectId: string; projectName: string; entries: WikiIndexEntryDto[] }>();
    rows.forEach((e) => {
      const g = byProject.get(e.projectId) ?? { projectId: e.projectId, projectName: e.projectName, entries: [] };
      g.entries.push(e);
      byProject.set(e.projectId, g);
    });
    return [...byProject.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [rows]);

  useEffect(() => setPageIndex(0), [q, projectId, sortKey, view]);
  const pageRows = rows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  const grouped = view === 'grouped';
  // A search is looking for something, so it never hides a match behind a folded project.
  const isOpen = (id: string) => !!q || !collapsed.includes(id);
  const toggle = (id: string) => setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const allFolded = groups.length > 0 && groups.every((g) => collapsed.includes(g.projectId));

  const handleDownload = async (evt: React.MouseEvent, e: WikiIndexEntryDto) => {
    evt.stopPropagation();
    setDownloadingId(e.pageId);
    try {
      await downloadWikiPagePdf(e.projectId, e.pageId, e.pageTitle);
    } catch {
      toast.error('Failed to download PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const SortHead = ({ label, column, className }: { label: string; column: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => setSortKey(column)}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', sortKey === column && 'text-foreground')}
      >
        {label}
        {sortKey === column
          ? (column === 'updated' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
          : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
      </button>
    </TableHead>
  );

  const pageRow = (e: WikiIndexEntryDto, showProject: boolean) => (
    <TableRow key={e.pageId} className="cursor-pointer" onClick={() => navigate(`/wiki/${e.projectId}/${e.pageId}`)}>
      <TableCell className={cn('py-1.5', !showProject && 'pl-9')}>
        {/* A long title wraps onto the next line rather than being cut off; the icon stays beside the first line. */}
        <span className="flex items-start gap-2">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className={cn('min-w-0 break-words font-medium leading-snug text-foreground', q && e.pageTitle.toLowerCase().includes(q) && 'text-primary')}>
            {e.pageTitle}
          </span>
          {e.restrictedToMembers && (
            <span title="Project members only" className="mt-0.5 shrink-0 text-muted-foreground">
              <Lock className="h-3 w-3" aria-label="Project members only" />
            </span>
          )}
        </span>
      </TableCell>
      {showProject && (
        <TableCell className="py-1.5 text-muted-foreground">
          <span className="block truncate">{e.projectName}</span>
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap py-1.5 text-xs text-muted-foreground">
        {new Date(touched(e)).toLocaleDateString()}
      </TableCell>
      <TableCell className="py-1.5">
        <button
          type="button"
          title="Download PDF"
          aria-label={`Download ${e.pageTitle} as PDF`}
          disabled={downloadingId === e.pageId}
          onClick={(evt) => handleDownload(evt, e)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="max-w-4xl space-y-3">
      <PageHeader
        title="Wiki"
        description="Documentation, architecture decisions and project notes from every project."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search pages or projects…"
            aria-label="Search pages or projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {/* Searchable: with every project's wiki here, the list gets long. Sized to match the search box. */}
        <SearchableSelect
          className="w-56 [&_input]:h-9 [&_input]:text-sm"
          value={projectId}
          onChange={setProjectId}
          placeholder="Find a project…"
          emptyLabel="No matching projects"
          options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-md border border-input text-xs">
          {([['grouped', 'By project'], ['list', 'List']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn('h-9 px-3 font-medium transition-colors',
                view === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{rows.length} page{rows.length === 1 ? '' : 's'}{grouped && groups.length > 0 ? ` in ${groups.length} project${groups.length === 1 ? '' : 's'}` : ''}</span>
          {grouped && groups.length > 1 && !q && (
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setCollapsed(allFolded ? [] : groups.map((g) => g.projectId))}
            >
              {allFolded ? 'Unfold all' : 'Fold all'}
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No wiki pages yet"
            description="Open a project and go to the Wiki tab to create the first page."
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No pages match"
            description="Try a different search term or project."
            action={
              <button onClick={() => { setQuery(''); setProjectId(''); }} className="text-sm text-primary hover:underline">
                Clear filters
              </button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Page" column="title" />
                {!grouped && <SortHead label="Project" column="project" className="w-[28%]" />}
                <SortHead label="Updated" column="updated" className="w-[7.5rem]" />
                <TableHead className="w-9"><span className="sr-only">Download</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped
                ? groups.map((g) => {
                    const open = isOpen(g.projectId);
                    return (
                      <Fragment key={g.projectId}>
                        <TableRow className="bg-muted/40 hover:bg-muted/60">
                          <TableCell colSpan={3} className="p-0">
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${g.projectName}, ${g.entries.length} page${g.entries.length === 1 ? '' : 's'}`}
                              onClick={() => toggle(g.projectId)}
                              className="flex w-full items-center gap-2 px-4 py-1.5 text-left"
                            >
                              {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{g.projectName}</span>
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{g.entries.length}</span>
                            </button>
                          </TableCell>
                          <TableCell className="p-0" />
                        </TableRow>
                        {open && g.entries.map((e) => pageRow(e, false))}
                      </Fragment>
                    );
                  })
                : pageRows.map((e) => pageRow(e, true))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!grouped && rows.length > PAGE_SIZE && (
        <Pagination
          page={pageIndex + 1}
          hasPrev={pageIndex > 0}
          hasMore={(pageIndex + 1) * PAGE_SIZE < rows.length}
          onPrev={() => setPageIndex((i) => i - 1)}
          onNext={() => setPageIndex((i) => i + 1)}
        />
      )}
    </div>
  );
}
