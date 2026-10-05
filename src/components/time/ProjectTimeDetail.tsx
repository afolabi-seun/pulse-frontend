import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectTimeActivity } from '../../api/timeEntries';
import Badge from '../ui/Badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ProjectActivityItemDto, ProjectHoursDto } from '../../types/api';

const STATUS: Record<string, { label: string; variant: 'green' | 'red' | 'gray' | 'yellow' | 'blue' }> = {
  backlog: { label: 'Backlog', variant: 'gray' },
  active:  { label: 'Active',  variant: 'green' },
  blocked: { label: 'Blocked', variant: 'red' },
  inQa:    { label: 'In QA',   variant: 'blue' },
  paused:  { label: 'Paused',  variant: 'yellow' },
  done:    { label: 'Done',    variant: 'gray' },
};

const MAX_ROWS = 50;
const round2 = (n: number) => Math.round(n * 100) / 100;
const TABLE_CLS = '[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide';

function Tab({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        selected ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function ItemLabel({ item }: { item: ProjectActivityItemDto }) {
  // A task the viewer can't open ("Private task") isn't linked; neither is a category row.
  if (!item.taskId || item.label === 'Private task')
    return <span className="font-medium text-foreground">{item.label}</span>;
  return (
    <span className="flex items-baseline gap-2">
      {item.key && <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.key}</span>}
      <Link to={`/tasks/${item.taskId}`} className="font-medium text-foreground hover:text-primary hover:underline">{item.label}</Link>
    </span>
  );
}

/**
 * Who logged the hours behind one "Hours by project" line of the Time Summary, and on what. Two tabs: by task (with
 * who logged each) and by person. Covers the same engineers and window as the line it opens from. Read-only.
 */
export default function ProjectTimeDetail({ project, from, to }: { project: ProjectHoursDto; from: string; to: string }) {
  const kind = project.kind ?? 'project';
  const { data, isLoading, error } = useProjectTimeActivity(kind, project.projectId, from, to);
  const [tab, setTab] = useState<'items' | 'people'>('items');
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <p className="px-4 py-3 text-xs text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="px-4 py-3 text-xs text-destructive">Couldn't load this breakdown.</p>;
  if (data.people.length === 0) return <p className="px-4 py-3 text-xs text-muted-foreground">No hours logged in this window.</p>;

  // The personal-tasks line names people only, never task titles — there is nothing to show by task.
  const hasItems = data.items.length > 0;
  const active = hasItems ? tab : 'people';
  const itemsLabel = kind === 'general' ? 'By category' : 'By task';
  const shownItems = showAll ? data.items : data.items.slice(0, MAX_ROWS);

  return (
    <div className="space-y-3 bg-muted/20 px-4 py-4" data-testid="project-time-detail">
      <div role="tablist" aria-label="Project hours detail" className="flex gap-2">
        {hasItems && <Tab selected={active === 'items'} onClick={() => setTab('items')}>{itemsLabel} · {data.items.length}</Tab>}
        <Tab selected={active === 'people'} onClick={() => setTab('people')}>By person · {data.people.length}</Tab>
      </div>

      {active === 'items' && (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table className={TABLE_CLS}>
            <TableHeader>
              <TableRow>
                <TableHead>{kind === 'general' ? 'Category' : 'Task'}</TableHead>
                {kind !== 'general' && <TableHead>Status</TableHead>}
                <TableHead>Who logged</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownItems.map((item) => {
                const status = item.status ? STATUS[item.status] : null;
                return (
                  <TableRow key={item.taskId ?? item.label}>
                    <TableCell className="max-w-[18rem] align-top"><ItemLabel item={item} /></TableCell>
                    {kind !== 'general' && (
                      <TableCell className="align-top">{status ? <Badge label={status.label} variant={status.variant} /> : '—'}</TableCell>
                    )}
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {item.people.map((p) => `${p.name} ${round2(p.hours)}h`).join(' · ')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right align-top font-semibold tabular-nums text-foreground">{round2(item.hours)}h</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={kind === 'general' ? 2 : 3} className="text-xs font-medium text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">{round2(data.totalHours)}h</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {data.items.length > MAX_ROWS && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="w-full border-t border-border px-3 py-2 text-center text-xs font-medium text-primary hover:underline">
              Show all {data.items.length}
            </button>
          )}
        </div>
      )}

      {active === 'people' && (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table className={TABLE_CLS}>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                {hasItems && kind !== 'general' && <TableHead className="text-right">Tasks</TableHead>}
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.people.map((p) => (
                <TableRow key={p.engineerId}>
                  <TableCell className="text-foreground">{p.name}</TableCell>
                  {hasItems && kind !== 'general' && <TableCell className="text-right tabular-nums text-muted-foreground">{p.tasks}</TableCell>}
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">{round2(p.hours)}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={hasItems && kind !== 'general' ? 2 : 1} className="text-xs font-medium text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">{round2(data.totalHours)}h</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
