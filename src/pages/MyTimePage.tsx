import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  CalendarOff, ChevronLeft, ChevronRight, ClipboardList, History, Layers, Lock,
  MoreHorizontal, Plus, Trash2, Users, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSessionState } from '../hooks/useSessionState';
import {
  useLogTimeEntry, useSaveTimeEntry, useDeleteTimeEntry,
  useTimeEntriesInRange, useTaskTimeSummary, useActiveTimer,
} from '../api/timeEntries';
import { useTaskList } from '../api/tasks';
import { useMyProjects } from '../api/projects';
import PageHeader from '../components/layout/PageHeader';
import TimerBar from '../components/time/TimerBar';
import TaskPreviewDrawer from '../components/tasks/TaskPreviewDrawer';
import Button from '../components/ui/Button';
import { FormPageSkeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { ScrollFadeX } from '@/components/ui/scroll-fade';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import { toIsoDate as toIso, getWeekStart, parseDateOnly } from '../lib/dates';
import type { TimeEntryDto } from '../types/api';

const CATEGORIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'admin',   label: 'Admin',   icon: ClipboardList },
  { value: 'leave',   label: 'Leave',   icon: CalendarOff },
  { value: 'other',   label: 'Other',   icon: MoreHorizontal },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// A pinned task row in these statuses has nothing left to log against — see stalePinIds below.
const STALE_PIN_STATUSES = new Set(['done', 'backlog']);

// A lightweight nudge, not a configurable policy — no per-org setting exists for either of
// these yet, so a sensible flat default is enough to reinforce the habit without new backend work.
const EXPECTED_DAILY_HOURS = 8;
const NUDGE_START_HOUR = 14; // 2pm local — "mid-afternoon"

interface RowDef { key: string; category: string; taskId: string | null; label: string; removable: boolean; icon: LucideIcon | null; /** A private to-do: no estimate to compare the hours against. */ personal?: boolean; }

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function rowKeyOf(category: string, taskId: string | null) { return `${category}|${taskId ?? ''}`; }

function GridCell({
  entries, disabled, onCommit, onOpenBreakdown,
}: {
  entries: TimeEntryDto[];
  disabled: boolean;
  onCommit: (value: string, existing: TimeEntryDto | undefined) => void;
  onOpenBreakdown: () => void;
}) {
  if (entries.length > 1) {
    const total = entries.reduce((s, e) => s + e.hours, 0);
    return (
      <button
        type="button"
        onClick={onOpenBreakdown}
        className="flex h-7 w-full items-center justify-center gap-1 rounded bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        title={`${entries.length} sessions — click to view`}
      >
        {total}h <Layers className="h-3 w-3" />
      </button>
    );
  }

  const entry = entries[0];
  return (
    <div className="group relative">
      <input
        key={`${entry?.id ?? 'empty'}-${entry?.hours ?? ''}`}
        type="number"
        step="0.25"
        min="0"
        max="24"
        disabled={disabled}
        defaultValue={entry ? entry.hours : ''}
        placeholder="–"
        onBlur={(e) => onCommit(e.target.value, entry)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={cn(
          'h-7 w-full rounded border border-transparent bg-transparent text-center text-xs',
          'hover:border-input focus:border-input focus:outline-none focus:ring-1 focus:ring-ring',
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          disabled && 'cursor-not-allowed opacity-40',
        )}
      />
      {!disabled && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onOpenBreakdown}
          title={entry ? 'Log another session for this day' : 'Log a session with a note'}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground group-hover:flex"
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function GridRow({
  row, days, todayIso, entriesByCell, rowTotal, commitCell, openBreakdown, onRemove, onOpenTask,
}: {
  row: RowDef;
  days: Date[];
  todayIso: string;
  entriesByCell: Map<string, TimeEntryDto[]>;
  rowTotal: (row: RowDef) => number;
  commitCell: (row: RowDef, dateIso: string, value: string, existing: TimeEntryDto | undefined) => void;
  openBreakdown: (row: RowDef, dateIso: string) => void;
  onRemove?: () => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const Icon = row.icon;
  const total = rowTotal(row);
  return (
    <tr>
      <td className="border border-border px-2.5 py-1 text-foreground">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          {row.taskId ? (
            <button
              type="button"
              onClick={() => onOpenTask?.(row.taskId!)}
              className="line-clamp-1 text-left hover:text-primary hover:underline"
              title="View task"
            >
              {row.label}
            </button>
          ) : (
            <span className="line-clamp-1">{row.label}</span>
          )}
        </div>
        {row.taskId && !row.personal && <TaskEstimateBadge taskId={row.taskId} />}
      </td>
      {days.map((d) => {
        const dateIso = toIso(d);
        const weekend = d.getDay() === 0 || d.getDay() === 6;
        const cellEntries = entriesByCell.get(`${row.key}::${dateIso}`) ?? [];
        return (
          <td key={dateIso} className={cn('border border-border px-0.5 py-0.5', weekend && 'bg-muted/10')}>
            <GridCell
              entries={cellEntries}
              disabled={dateIso > todayIso}
              onCommit={(value, existing) => commitCell(row, dateIso, value, existing)}
              onOpenBreakdown={() => openBreakdown(row, dateIso)}
            />
          </td>
        );
      })}
      <td className="border border-border px-2 py-1 text-center font-semibold text-foreground">{total}h</td>
      <td className="border border-border px-1 py-1 text-center">
        {onRemove && total === 0 && (
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function MyTimePage() {
  const { currentUser, allow } = useAuth();
  const canSubmit = allow('time-entry-submitter');

  const [weekOffset, setWeekOffset] = useState(0);
  // Kept across navigation: a freshly added row has no logged hours yet, so without this it would
  // vanish the moment the engineer left the page.
  const [extraTaskRowIds, setExtraTaskRowIds] = useSessionState<string[]>(
    `pulse_time_pinned_rows_${currentUser?.id ?? 'anon'}`, []);
  const [addingTaskRow, setAddingTaskRow] = useState(false);
  const [breakdownCell, setBreakdownCell] = useState<{ row: RowDef; dateIso: string } | null>(null);
  const [breakdownNote, setBreakdownNote] = useState('');
  const [breakdownHours, setBreakdownHours] = useState('');
  const [breakdownProjectId, setBreakdownProjectId] = useState('');
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  const saveEntry = useSaveTimeEntry();
  const logEntry = useLogTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const { data: myProjects } = useMyProjects();
  // Shares TimerBar's own query (react-query dedupes identical keys), so this costs no extra request.
  const { data: activeTimer } = useActiveTimer(canSubmit);

  const weekStart = useMemo(() => addDays(parseDateOnly(getWeekStart(toIso(new Date()))), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartIso = toIso(weekStart);
  const weekEndIso = toIso(days[6]);
  const todayIso = toIso(new Date());
  const nudgeDismissKey = `pulse_time_nudge_dismissed_${todayIso}`;
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return localStorage.getItem(nudgeDismissKey) === '1'; } catch { return false; }
  });

  const { data: weekEntries, isLoading } = useTimeEntriesInRange(weekStartIso, weekEndIso, currentUser!.id);
  const { data: myTasks } = useTaskList({ assigneeId: currentUser!.id, limit: 100 });

  const items = weekEntries?.items ?? [];
  const taskTitleById = useMemo(() => new Map((myTasks?.items ?? []).map((t) => [t.id, t.taskKey ? `${t.taskKey} — ${t.title}` : t.title])), [myTasks]);
  // A row is kept for any task with real logged hours this week even once it's left the current
  // "my tasks" list (see stalePinIds below) — taskTitleById alone would then have nothing for it,
  // so fall back to the title each entry already carries (ListTimeEntriesQuery resolves it
  // independently of the viewer's active roster) rather than showing the generic word "Task".
  const entryTaskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of items) if (e.taskId && e.taskTitle) map.set(e.taskId, e.taskTitle);
    return map;
  }, [items]);
  // Paused/Blocked can't accrue new time at all, so both pickers exclude them; Backlog is only
  // excluded from the manual "add task to log" picker — starting a timer on it is still how the
  // Unclaimed tab claims a backlog task, so the timer's own "My tasks" picker keeps it reachable.
  const timerTasks = (myTasks?.items ?? []).filter((t) => !['done', 'paused', 'blocked'].includes(t.status));
  const loggableTasks = timerTasks.filter((t) => t.status !== 'backlog');

  const entriesByCell = useMemo(() => {
    const map = new Map<string, TimeEntryDto[]>();
    for (const e of items) {
      const key = `${rowKeyOf(e.category, e.taskId)}::${e.date}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [items]);

  // A manually pinned row ("+ Add task row") has no fixed lifetime — once its task is no longer
  // something you'd keep logging against (Done, back in Backlog, reassigned to someone else, or
  // deleted outright), it has no reason to keep following the viewer into weeks where nothing was
  // ever logged against it. A week with real logged hours always keeps its row regardless of
  // status (that's history, not clutter) — only the *pin itself* drops. Paused/Blocked are
  // deliberately NOT included here — those are usually temporary, so the pin staying put until
  // the task resumes is the useful behavior. Skipped while myTasks hasn't loaded yet, so an
  // in-flight fetch doesn't momentarily look like every pinned task vanished.
  const stalePinIds = useMemo(() => {
    if (!myTasks) return new Set<string>();
    const myTaskById = new Map(myTasks.items.map((t) => [t.id, t]));
    const stale = new Set<string>();
    for (const id of extraTaskRowIds) {
      const task = myTaskById.get(id);
      // Missing entirely = reassigned away or deleted; present but Done/Backlog = still yours
      // but no longer something to keep a pinned logging row open for.
      if (!task || STALE_PIN_STATUSES.has(task.status)) stale.add(id);
    }
    return stale;
  }, [myTasks, extraTaskRowIds]);
  const taskRowIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of extraTaskRowIds) if (!stalePinIds.has(id)) ids.add(id);
    for (const e of items) if (e.category === 'task' && e.taskId) ids.add(e.taskId);
    return [...ids];
  }, [items, extraTaskRowIds, stalePinIds]);

  const personalTaskIds = useMemo(() => new Set((myTasks?.items ?? []).filter((t) => t.isPersonal).map((t) => t.id)), [myTasks]);

  const taskRows: RowDef[] = useMemo(() => taskRowIds.map((id) => ({
    key: rowKeyOf('task', id), category: 'task', taskId: id,
    label: taskTitleById.get(id) ?? entryTaskTitleById.get(id) ?? 'Task', removable: true, icon: null,
    personal: personalTaskIds.has(id),
  })), [taskRowIds, taskTitleById, entryTaskTitleById, personalTaskIds]);

  const categoryRows: RowDef[] = useMemo(() => CATEGORIES.map((c) => ({
    key: rowKeyOf(c.value, null), category: c.value, taskId: null,
    label: c.label, removable: false, icon: c.icon,
  })), []);

  const rows = useMemo(() => [...taskRows, ...categoryRows], [taskRows, categoryRows]);

  // Timer-logged sessions carry arbitrary two-decimal hours (e.g. 0.06h), unlike the grid's own
  // 0.25-step manual entries — summing those in plain floating point surfaces artifacts like
  // 0.35000000000000003, so every total is rounded to 2dp at the source.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rowTotal = (row: RowDef) =>
    round2(days.reduce((sum, d) => sum + (entriesByCell.get(`${row.key}::${toIso(d)}`) ?? []).reduce((s, e) => s + e.hours, 0), 0));
  const dayTotal = (dateIso: string) =>
    round2(rows.reduce((sum, row) => sum + (entriesByCell.get(`${row.key}::${dateIso}`) ?? []).reduce((s, e) => s + e.hours, 0), 0));
  const grandTotal = round2(rows.reduce((sum, row) => sum + rowTotal(row), 0));

  const availableTasksToAdd = loggableTasks.filter((t) => !taskRowIds.includes(t.id));

  const commitCell = (row: RowDef, dateIso: string, valueStr: string, existing: TimeEntryDto | undefined) => {
    // Rounded to the DB column's own 2dp precision — an unrounded value (a paste, a spinner nudge
    // off an already-imprecise decimal) would otherwise reach the API as-is, unlike the timer path,
    // which already rounds to 2dp before logging (see StartTimerHandler/StopTimerHandler).
    const hours = valueStr.trim() === '' ? null : round2(Number(valueStr));

    if (!existing) {
      if (hours && hours > 0) {
        logEntry.mutate(
          { date: dateIso, category: row.category, taskId: row.taskId ?? undefined, hours },
          { onError: () => toast.error('Failed to log time.') },
        );
      }
      return;
    }

    if (hours === null || hours <= 0) {
      deleteEntry.mutate(existing.id, { onError: () => toast.error('Failed to remove entry.') });
      return;
    }

    if (hours === existing.hours) return;

    saveEntry.mutate(
      { id: existing.id, body: { date: dateIso, category: row.category, taskId: row.taskId ?? undefined, hours, note: existing.note ?? undefined } },
      { onError: () => toast.error('Failed to update entry.') },
    );
  };

  const openBreakdown = (row: RowDef, dateIso: string) => {
    setBreakdownCell({ row, dateIso });
    setBreakdownHours('');
    setBreakdownNote('');
    setBreakdownProjectId('');
  };

  const addSessionToBreakdown = () => {
    if (!breakdownCell) return;
    const hours = round2(Number(breakdownHours));
    if (!hours || hours <= 0) return;
    logEntry.mutate(
      {
        date: breakdownCell.dateIso, category: breakdownCell.row.category, taskId: breakdownCell.row.taskId ?? undefined,
        projectId: breakdownProjectId || undefined, hours, note: breakdownNote || undefined,
      },
      {
        onSuccess: () => { setBreakdownHours(''); setBreakdownNote(''); setBreakdownProjectId(''); },
        onError: () => toast.error('Failed to log time.'),
      },
    );
  };

  const setEntryProject = (entry: TimeEntryDto, projectId: string) => {
    saveEntry.mutate(
      {
        id: entry.id,
        body: {
          date: entry.date, category: entry.category, taskId: entry.taskId ?? undefined,
          projectId: projectId || undefined, hours: entry.hours, note: entry.note ?? undefined,
        },
      },
      { onError: () => toast.error('Failed to update entry.') },
    );
  };

  const setEntryNote = (entry: TimeEntryDto, note: string) => {
    if (note === (entry.note ?? '')) return;
    saveEntry.mutate(
      {
        id: entry.id,
        body: {
          date: entry.date, category: entry.category, taskId: entry.taskId ?? undefined,
          projectId: entry.projectId ?? undefined, hours: entry.hours, note: note || undefined,
        },
      },
      { onError: () => toast.error('Failed to update entry.') },
    );
  };

  if (!canSubmit) {
    return (
      <div className="max-w-lg">
        <PageHeader title="My Time" />
        <Card>
          <EmptyState icon={Lock} title="Not available for your role"
            description="Time tracking is for delivery-side roles. PMO and Executive accounts don't log time." />
        </Card>
      </div>
    );
  }

  if (isLoading) return <FormPageSkeleton fields={3} />;

  // Only nudge for "today," on a weekday, in the current week's view — not while browsing past
  // or future weeks, and not on a day nobody expects to be logging time on.
  const now = new Date();
  const isWeekday = now.getDay() !== 0 && now.getDay() !== 6;
  const inNudgeWindow = weekOffset === 0 && isWeekday && now.getHours() >= NUDGE_START_HOUR;
  const hoursLoggedToday = dayTotal(todayIso);
  let nudgeMessage: string | null = null;
  if (inNudgeWindow && !nudgeDismissed) {
    if (hoursLoggedToday === 0 && !activeTimer) {
      nudgeMessage = "You haven't started a timer today — don't forget to track your time.";
    } else if (hoursLoggedToday > 0 && hoursLoggedToday < EXPECTED_DAILY_HOURS) {
      nudgeMessage = `You've logged ${hoursLoggedToday}h today — expected ~${EXPECTED_DAILY_HOURS}h.`;
    }
  }
  const dismissNudge = () => {
    try { localStorage.setItem(nudgeDismissKey, '1'); } catch { /* best-effort only */ }
    setNudgeDismissed(true);
  };

  const breakdownEntries = breakdownCell
    ? entriesByCell.get(`${breakdownCell.row.key}::${breakdownCell.dateIso}`) ?? []
    : [];

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="My Time" />

      <TimerBar openTasks={timerTasks} myProjects={myProjects ?? []} tasksLoaded={!!myTasks} />

      {nudgeMessage && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
          <span>{nudgeMessage}</span>
          <button
            type="button"
            onClick={dismissNudge}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-1.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <button type="button" onClick={() => setWeekOffset(0)} className="text-xs text-primary hover:underline">
              This week
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">{grandTotal}h total</span>
          <Button size="sm" variant="secondary" onClick={() => setAddingTaskRow(true)} disabled={availableTasksToAdd.length === 0}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add task row
          </Button>
        </div>
      </div>

      <ScrollFadeX>
      <Card className="max-h-[70vh] overflow-auto p-0">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-44 border border-border bg-card px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Task / category
              </th>
              {days.map((d) => {
                const dateIso = toIso(d);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={dateIso} className={cn(
                    'sticky top-0 z-10 w-14 border border-border bg-card px-1 py-1.5 text-center font-semibold text-muted-foreground',
                    weekend && 'bg-muted/40',
                    dateIso === todayIso && 'text-primary',
                  )}>
                    {DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                    <div className="font-normal">{d.getDate()}</div>
                  </th>
                );
              })}
              <th className="sticky top-0 z-10 w-14 border border-border bg-card px-2 py-1.5 text-center font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
              <th className="sticky top-0 z-10 w-7 border border-border bg-card" />
            </tr>
          </thead>
          {taskRows.length > 0 && (
            <tbody>
              <tr>
                <td colSpan={10} className="border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tasks
                </td>
              </tr>
              {taskRows.map((row) => (
                <GridRow key={row.key} row={row} days={days} todayIso={todayIso} entriesByCell={entriesByCell}
                  rowTotal={rowTotal} commitCell={commitCell} openBreakdown={openBreakdown}
                  onRemove={() => setExtraTaskRowIds((ids) => ids.filter((id) => id !== row.taskId))}
                  onOpenTask={setPreviewTaskId} />
              ))}
            </tbody>
          )}
          <tbody>
            <tr>
              <td colSpan={10} className="border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Categories
              </td>
            </tr>
            {categoryRows.map((row) => (
              <GridRow key={row.key} row={row} days={days} todayIso={todayIso} entriesByCell={entriesByCell}
                rowTotal={rowTotal} commitCell={commitCell} openBreakdown={openBreakdown} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="border border-border bg-muted/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</td>
              {days.map((d) => {
                const dateIso = toIso(d);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <td key={dateIso} className={cn('border border-border bg-muted/30 px-2 py-1.5 text-center font-semibold text-foreground', weekend && 'bg-muted/50')}>
                    {dayTotal(dateIso)}h
                  </td>
                );
              })}
              <td className="border border-border bg-muted/30 px-2 py-1.5 text-center font-bold text-foreground">{grandTotal}h</td>
              <td className="border border-border bg-muted/30" />
            </tr>
          </tfoot>
        </table>
      </Card>
      </ScrollFadeX>

      <Link
        to="/my-time/history"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        View earlier entries
      </Link>

      <Dialog open={!!breakdownCell} onOpenChange={(v) => !v && setBreakdownCell(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {breakdownCell?.row.label} — {breakdownCell && formatShortDate(breakdownCell.dateIso)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {breakdownEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <input
                    key={entry.id}
                    type="text"
                    defaultValue={entry.note ?? ''}
                    placeholder="Note (optional)"
                    onBlur={(e) => setEntryNote(entry, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-xs text-foreground hover:border-input focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {breakdownCell?.row.category !== 'task' && (
                    <SearchableSelect
                      className="w-full [&_input]:h-7 [&_input]:text-xs"
                      value={entry.projectId ?? ''}
                      onChange={(v) => setEntryProject(entry, v)}
                      placeholder="General (no specific project)"
                      emptyLabel="No matching projects"
                      options={[{ value: '', label: 'General (no specific project)' }, ...(myProjects ?? []).map((p) => ({ value: p.id, label: p.name }))]}
                    />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{entry.hours}h</span>
                <button
                  type="button"
                  onClick={() => deleteEntry.mutate(entry.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <Label>{breakdownEntries.length === 0 ? 'Add a session' : 'Add another session'}</Label>
            <div className="flex gap-2">
              <input
                type="number" step="0.25" min="0.25" max="24" placeholder="Hours"
                value={breakdownHours}
                onChange={(e) => setBreakdownHours(e.target.value)}
                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Textarea rows={1} placeholder="Note (optional)" value={breakdownNote} onChange={(e) => setBreakdownNote(e.target.value)} className="min-h-9" />
            </div>
            {breakdownCell?.row.category !== 'task' && (
              <SearchableSelect
                value={breakdownProjectId}
                onChange={setBreakdownProjectId}
                placeholder="General (no specific project)"
                emptyLabel="No matching projects"
                options={[{ value: '', label: 'General (no specific project)' }, ...(myProjects ?? []).map((p) => ({ value: p.id, label: p.name }))]}
              />
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setBreakdownCell(null)}>Done</Button>
            <Button size="sm" onClick={addSessionToBreakdown} loading={logEntry.isPending}>Add session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingTaskRow} onOpenChange={(v) => !v && setAddingTaskRow(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add a task row</DialogTitle>
          </DialogHeader>
          <SearchableSelect
            value=""
            onChange={(v) => {
              setExtraTaskRowIds((ids) => [...ids, v]);
              setAddingTaskRow(false);
            }}
            placeholder="Search tasks…"
            emptyLabel="No tasks to add"
            options={availableTasksToAdd.map((t) => ({ value: t.id, label: t.taskKey ? `${t.taskKey} — ${t.title}` : t.title }))}
          />
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setAddingTaskRow(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}

function formatShortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function TaskEstimateBadge({ taskId }: { taskId: string }) {
  const { data } = useTaskTimeSummary(taskId);
  // Tracks the last-seen total/expected so the warning fires only on a fresh crossing caused
  // by an edit this session — never retroactively on first load of an already-over-estimate task.
  const prevRef = useRef<{ total: number; expected: number } | null>(null);

  useEffect(() => {
    if (!data || data.expectedHours == null) return;
    const prev = prevRef.current;
    prevRef.current = { total: data.totalHoursLogged, expected: data.expectedHours };
    if (!prev) return;

    const wasOver = prev.total > prev.expected * 1.5;
    const isOver = data.totalHoursLogged > data.expectedHours * 1.5;
    if (isOver && !wasOver) {
      const pct = Math.round((data.totalHoursLogged / data.expectedHours) * 100);
      toast.warning(
        `This task has now logged ${data.totalHoursLogged}h against an estimated ${data.expectedHours.toFixed(1)}h (${pct}%) — consider flagging it for re-estimation.`,
      );
    }
  }, [data?.totalHoursLogged, data?.expectedHours]);

  if (!data || data.expectedHours == null) return null;
  const over = data.totalHoursLogged > data.expectedHours * 1.5;
  return (
    <p className={cn('text-[10px]', over ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
      Est: ≈{data.expectedHours.toFixed(1)}h{over && ' — over estimate'}
    </p>
  );
}
