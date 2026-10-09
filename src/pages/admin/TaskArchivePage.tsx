import { useState } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectList } from '../../api/projects';
import {
  useArchiveTasks, useArchivedTasks, useRestoreArchivedTask,
  type ArchiveTasksResult,
} from '../../api/taskArchive';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '../../lib/dates';

const DEFAULT_REASON = 'Pilot clean-up: tasks created before the baseline were archived so reporting starts fresh.';

function StatusCounts({ p }: { p: ArchiveTasksResult['projects'][number] }) {
  const parts: [string, number][] = [
    ['backlog', p.backlog], ['active', p.active], ['blocked', p.blocked],
    ['in QA', p.inQa], ['paused', p.paused], ['done', p.done],
  ];
  return <>{parts.filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}`).join(' · ')}</>;
}

export default function TaskArchivePage() {
  const { data: projects } = useProjectList();
  const [baseline, setBaseline] = useState('');
  const [projectId, setProjectId] = useState('');
  const [includeTouched, setIncludeTouched] = useState(false);
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [preview, setPreview] = useState<ArchiveTasksResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const [listProject, setListProject] = useState('');

  const archive = useArchiveTasks();
  const restore = useRestoreArchivedTask();
  const archived = useArchivedTasks({ projectId: listProject || undefined, page });

  const request = (dryRun: boolean) => ({
    baselineStart: baseline,
    projectIds: projectId ? [projectId] : undefined,
    includeTouched,
    dryRun,
    reason: reason.trim(),
    // Midnight on the baseline day in the admin's own time zone (fixed offset, as the server expects).
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });

  function runPreview() {
    archive.mutate(request(true), {
      onSuccess: setPreview,
      onError: () => toast.error('Could not build the preview.'),
    });
  }

  function runArchive() {
    setConfirming(false);
    archive.mutate(request(false), {
      onSuccess: (r) => {
        toast.success(`Archived ${r.toArchive} tasks.`);
        setPreview(r);
      },
      onError: () => toast.error('Archiving failed. Nothing was changed.'),
    });
  }

  function handleRestore(id: string) {
    restore.mutate(id, {
      onSuccess: (n) => toast.success(`Restored ${n} task${n === 1 ? '' : 's'}.`),
      onError: () => toast.error('Could not restore the task.'),
    });
  }

  const inputClass = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
  const ranFor = preview && !preview.dryRun ? preview : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Task archive" />

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Archive tasks created before a date</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Archived tasks disappear from boards, lists, reports and workload, but nothing is deleted and any task can be restored below.
            Tasks in personal projects are never archived. A task someone has touched since the date (a status change, comment or time entry)
            is kept, unless you choose otherwise.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium">
            Baseline start (tasks created before 00:00 on this day, your local time)
            <input id="archive-baseline" type="date" className={`${inputClass} block w-full`} value={baseline}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setBaseline(e.target.value); setPreview(null); }} />
          </label>
          <label className="space-y-1 text-xs font-medium">
            Project
            <select id="archive-project" className={`${inputClass} block w-full`} value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setPreview(null); }}>
              <option value="">Whole system</option>
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <input id="archive-include-touched" type="checkbox" checked={includeTouched}
            onChange={(e) => { setIncludeTouched(e.target.checked); setPreview(null); }} />
          Also archive tasks touched since the baseline (not recommended)
        </label>

        <label className="block space-y-1 text-xs font-medium">
          Reason (recorded in the audit log and on each task)
          <Textarea id="archive-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={runPreview} loading={archive.isPending && !confirming} disabled={!baseline}>
            Preview
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)}
            disabled={!preview?.dryRun || preview.toArchive === 0 || !reason.trim() || archive.isPending}>
            <Archive className="h-4 w-4" /> Archive {preview?.dryRun ? preview.toArchive : ''} tasks
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{ranFor ? 'Archived' : 'Preview'}: tasks created before {preview.baselineStart}</h2>
            <Badge variant="blue" label={`${preview.toArchive} ${ranFor ? 'archived' : 'to archive'}`} />
            <Badge label={`${preview.done} done`} />
            <Badge variant="yellow" label={`${preview.open} not done`} />
            <Badge label={`${preview.keptBecauseTouched} kept (active since)`} />
          </div>

          {preview.projects.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Tasks</TableHead><TableHead>By status</TableHead></TableRow></TableHeader>
              <TableBody>
                {preview.projects.map((p) => (
                  <TableRow key={p.projectId}>
                    <TableCell>{p.projectName}</TableCell>
                    <TableCell>{p.total}</TableCell>
                    <TableCell className="text-xs text-muted-foreground"><StatusCounts p={p} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {preview.openTasks.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold">Not-done tasks being archived (tell their owners)</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Status</TableHead><TableHead>Assignee</TableHead><TableHead>Project</TableHead></TableRow></TableHeader>
                <TableBody>
                  {preview.openTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.key} {t.title}</TableCell><TableCell>{t.status}</TableCell>
                      <TableCell>{t.assigneeName ?? 'Unassigned'}</TableCell><TableCell>{t.projectName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.openTasksTruncated && <p className="mt-1 text-xs text-muted-foreground">Showing the first {preview.openTasks.length}; narrow by project to see the rest.</p>}
            </div>
          )}

          {preview.keptTasks.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold">Kept because something happened to them since the baseline</h3>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {preview.keptTasks.map((t) => <li key={t.id}>{t.key} {t.title} · {t.status} · {t.assigneeName ?? 'Unassigned'}</li>)}
              </ul>
              {preview.keptTasksTruncated && <p className="mt-1 text-xs text-muted-foreground">List truncated.</p>}
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Archived tasks{archived.data ? ` (${archived.data.total})` : ''}</h2>
          <select id="archived-project-filter" aria-label="Filter archived tasks by project" className={inputClass} value={listProject}
            onChange={(e) => { setListProject(e.target.value); setPage(1); }}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {archived.data && archived.data.items.length === 0 ? (
          <EmptyState icon={Archive} title="Nothing archived" description="Archived tasks appear here and can be restored." />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Task</TableHead><TableHead>Status</TableHead><TableHead>Project</TableHead><TableHead>Archived</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {(archived.data?.items ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.key} {t.title}{t.isQaTask && <span className="ml-1 text-xs text-muted-foreground">(QA)</span>}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>{t.projectName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.archivedAt)}{t.archivedByName ? ` · ${t.archivedByName}` : ''}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleRestore(t.id)} loading={restore.isPending && restore.variables === t.id}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {archived.data && archived.data.total > archived.data.pageSize && (
          <div className="flex items-center justify-end gap-2 text-xs">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page}</span>
            <Button variant="ghost" size="sm" disabled={page * archived.data.pageSize >= archived.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirming}
        title={`Archive ${preview?.toArchive ?? 0} tasks?`}
        description={`This hides ${preview?.open ?? 0} not-done and ${preview?.done ?? 0} done tasks created before ${preview?.baselineStart ?? ''} from boards, lists and reports. Nothing is deleted and each task can be restored.`}
        confirmLabel="Archive"
        onConfirm={runArchive}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
