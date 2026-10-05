import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEngineerTimeActivity } from '../../api/timeEntries';
import { parseDateOnly, todayIso } from '../../lib/dates';
import Badge from '../ui/Badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ActivityTaskDto } from '../../types/api';

const CATEGORY_LABEL: Record<string, string> = {
  meeting: 'Meetings', admin: 'Admin', leave: 'Leave', other: 'Other',
};

const STATUS: Record<string, { label: string; variant: 'green' | 'red' | 'gray' | 'yellow' | 'blue' }> = {
  backlog: { label: 'Backlog', variant: 'gray' },
  active:  { label: 'Active',  variant: 'green' },
  blocked: { label: 'Blocked', variant: 'red' },
  inQa:    { label: 'In QA',   variant: 'blue' },
  paused:  { label: 'Paused',  variant: 'yellow' },
  done:    { label: 'Done',    variant: 'gray' },
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const shortDay = (iso: string) =>
  parseDateOnly(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dueLabel = (iso: string) =>
  parseDateOnly(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const TABLE_CLS = '[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide';

/** A task cell: key + linked title, then any notes the engineer wrote, day by day. */
function TaskCell({ task }: { task: ActivityTaskDto }) {
  // A task the viewer can't open (someone else's personal task, or one hidden from them) isn't linked.
  const linkable = task.title !== 'Personal task' && task.title !== 'Private task';
  const notes = task.entries.filter((e) => e.note);
  return (
    <TableCell className="max-w-[18rem] align-top">
      <div className="flex items-baseline gap-2">
        {task.key && <span className="shrink-0 font-mono text-xs text-muted-foreground">{task.key}</span>}
        {linkable
          ? <Link to={`/tasks/${task.taskId}`} className="font-medium text-foreground hover:text-primary hover:underline">{task.title}</Link>
          : <span className="font-medium text-foreground">{task.title}</span>}
      </div>
      {notes.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {notes.map((e, i) => <li key={`${e.date}-${i}`}>{shortDay(e.date)}: {e.note}</li>)}
        </ul>
      )}
    </TableCell>
  );
}

/** The days the hours were logged on, e.g. "Mon 28 Sep · 0.65h". */
function LoggedCell({ task }: { task: ActivityTaskDto }) {
  return (
    <TableCell className="align-top text-xs text-muted-foreground">
      {task.entries.length === 0
        ? '—'
        : (
          <ul className="space-y-0.5">
            {task.entries.map((e, i) => <li key={`${e.date}-${i}`} className="whitespace-nowrap">{shortDay(e.date)} · {round2(e.hours)}h</li>)}
          </ul>
        )}
    </TableCell>
  );
}

function HoursCell({ hours }: { hours: number }) {
  return (
    <TableCell className={cn('whitespace-nowrap text-right align-top tabular-nums', hours === 0 ? 'text-xs font-medium text-amber-600 dark:text-amber-400' : 'font-semibold text-foreground')}>
      {hours === 0 ? 'no time logged' : `${round2(hours)}h`}
    </TableCell>
  );
}

/** A task row in the logged table, noting whether it is still assigned to the engineer. */
type Row = ActivityTaskDto & { assignedNow: boolean };

function StatusCell({ task, assignedNow }: { task: ActivityTaskDto; assignedNow: boolean }) {
  const status = task.status ? STATUS[task.status] : null;
  return (
    <TableCell className="align-top">
      {status ? <Badge label={status.label} variant={status.variant} /> : '—'}
      {!assignedNow && <span className="mt-0.5 block whitespace-nowrap text-[10px] text-muted-foreground">no longer assigned</span>}
    </TableCell>
  );
}

function DueCell({ task }: { task: ActivityTaskDto }) {
  // Overdue only means something for work that is under way: a Backlog task hasn't started, and a
  // finished one is done — neither is "late".
  const overdue = !!task.dueDate && task.dueDate.slice(0, 10) < todayIso() && task.status !== 'done' && task.status !== 'backlog';
  return (
    <TableCell className={cn('whitespace-nowrap align-top', overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
      {task.dueDate ? dueLabel(task.dueDate) : '—'}
    </TableCell>
  );
}

/** Every task with hours in the period — what adds up to the engineer's total. */
function LoggedTable({ rows }: { rows: Row[] }) {
  const total = round2(rows.reduce((sum, t) => sum + t.hours, 0));
  return (
    <Table className={TABLE_CLS}>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Logged</TableHead>
          <TableHead className="text-right">Hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.taskId}>
            <TaskCell task={t} />
            <TableCell className="align-top text-muted-foreground">{t.projectName ?? '—'}</TableCell>
            <StatusCell task={t} assignedNow={t.assignedNow} />
            <DueCell task={t} />
            <LoggedCell task={t} />
            <HoursCell hours={t.hours} />
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5} className="text-xs font-medium text-muted-foreground">Total on tasks</TableCell>
          <TableCell className="text-right font-semibold tabular-nums text-foreground">{total}h</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

/** Assigned work that has had no time logged in the period — the gaps. */
function NotLoggedTable({ tasks }: { tasks: ActivityTaskDto[] }) {
  return (
    <Table className={TABLE_CLS}>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => (
          <TableRow key={t.taskId}>
            <TaskCell task={t} />
            <TableCell className="align-top text-muted-foreground">{t.projectName ?? '—'}</TableCell>
            <StatusCell task={t} assignedNow />
            <DueCell task={t} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OtherTimeTable({ otherTime }: { otherTime: { category: string; hours: number }[] }) {
  return (
    <Table className={TABLE_CLS}>
      <TableHeader>
        <TableRow>
          <TableHead>Other time</TableHead>
          <TableHead className="text-right">Hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {otherTime.map((c) => (
          <TableRow key={c.category}>
            <TableCell className="text-foreground">{CATEGORY_LABEL[c.category] ?? c.category}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums text-foreground">{round2(c.hours)}h</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

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

/**
 * What one engineer logged in a period, and what they're assigned to but haven't logged — the detail behind a
 * Time Summary total, for someone reviewing timesheets. It opens on the work that adds up to the total; a second
 * tab lists assigned work with no time logged. Read-only.
 */
export default function EngineerTimeDetail({ engineerId, from, to }: { engineerId: string; from: string; to: string }) {
  const { data, isLoading, error } = useEngineerTimeActivity(engineerId, from, to);
  const [tab, setTab] = useState<'logged' | 'notLogged' | null>(null);

  if (isLoading) return <p className="px-4 py-3 text-xs text-muted-foreground">Loading entries…</p>;
  if (error || !data) return <p className="px-4 py-3 text-xs text-destructive">Couldn't load this engineer's entries.</p>;

  const { assigned, loggedOnly, otherTime } = data;
  const loggedRows: Row[] = [
    ...assigned.filter((t) => t.hours > 0).map((t) => ({ ...t, assignedNow: true })),
    ...loggedOnly.map((t) => ({ ...t, assignedNow: false })),
  ].sort((a, b) => b.hours - a.hours);
  const notLogged = assigned.filter((t) => t.hours === 0);

  if (loggedRows.length === 0 && notLogged.length === 0 && otherTime.length === 0)
    return <p className="px-4 py-3 text-xs text-muted-foreground">Nothing assigned and no entries in this period.</p>;

  const taskHours = round2(loggedRows.reduce((sum, t) => sum + t.hours, 0));
  const otherHours = round2(otherTime.reduce((sum, c) => sum + c.hours, 0));
  const hasLogged = loggedRows.length > 0 || otherTime.length > 0;
  // Open on what adds up to the total; fall back to the gaps if nothing was logged at all.
  const active = tab ?? (hasLogged ? 'logged' : 'notLogged');

  return (
    <div className="space-y-3 bg-muted/20 px-4 py-4" data-testid="engineer-time-detail">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Time detail" className="flex gap-2">
          <Tab selected={active === 'logged'} onClick={() => setTab('logged')}>
            Logged time · {round2(taskHours + otherHours)}h
          </Tab>
          <Tab selected={active === 'notLogged'} onClick={() => setTab('notLogged')}>
            Assigned, not logged · {notLogged.length}
          </Tab>
        </div>
        {active === 'logged' && hasLogged && (
          <span className="text-xs text-muted-foreground">
            {taskHours}h on {loggedRows.length} {loggedRows.length === 1 ? 'task' : 'tasks'}
            {otherHours > 0 && ` + ${otherHours}h other time`}
          </span>
        )}
      </div>

      {active === 'logged' && (
        <div className="space-y-3">
          {loggedRows.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border bg-card"><LoggedTable rows={loggedRows} /></div>
          )}
          {otherTime.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border bg-card"><OtherTimeTable otherTime={otherTime} /></div>
          )}
          {!hasLogged && <p className="text-xs text-muted-foreground">No time logged in this period.</p>}
        </div>
      )}

      {active === 'notLogged' && (
        notLogged.length > 0
          ? <div className="overflow-x-auto rounded-md border border-border bg-card"><NotLoggedTable tasks={notLogged} /></div>
          : <p className="text-xs text-muted-foreground">Everything assigned to them has time logged in this period.</p>
      )}
    </div>
  );
}
