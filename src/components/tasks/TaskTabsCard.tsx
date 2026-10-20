import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { useTaskList } from '../../api/tasks';
import { useReportingBaseline } from '../../api/reports';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import Badge from '../ui/Badge';
import { Pagination } from '../ui/Pagination';
import { Skeleton } from '../ui/skeleton';
import { Card } from '../ui/card';
import { FILTER_INPUT } from '../ui/FilterBar';
import { cn } from '@/lib/utils';
import { daysLate, formatDate, parseDateOnly, toIsoDate, todayIso, workingDaysSince } from '../../lib/dates';
import { STATUS_LABEL, STATUS_VARIANT } from '../../lib/taskStatus';
import type { TaskDto, TaskStatus } from '../../types/api';

type Tab = 'current' | 'history';

/** Active and Blocked are the work that counts toward workload, so they are the Current tab. Everything else is History. */
const CURRENT_STATUSES = 'active,blocked';
const HISTORY_STATUSES: TaskStatus[] = ['done', 'inQa', 'backlog', 'paused'];
const LEFT_OUT_STATUSES: TaskStatus[] = ['inQa', 'paused', 'backlog'];
const DEFAULT_HISTORY_DAYS = 30;

function daysAgoIso(days: number): string {
  const d = parseDateOnly(todayIso());
  d.setDate(d.getDate() - days);
  return toIsoDate(d);
}

interface Props {
  /** Whose tasks. */
  assigneeId: string;
  onPreview: (taskId: string) => void;
  /** A heading before the tabs (the dashboard's "My tasks"); the engineer page needs none. */
  title?: string;
  /** Right-aligned header content, e.g. a "View all" link or a collapse button. */
  headerExtra?: React.ReactNode;
  /** Hides the body and stops fetching, for a collapsible card. */
  collapsed?: boolean;
  /** Tighter rows, for the dashboard. */
  compact?: boolean;
}

/** A person's tasks in two tabs: what they are working on now (Current), and everything else — finished, in QA, paused, backlog — with filters (History). */
export default function TaskTabsCard({ assigneeId, onPreview, title, headerExtra, collapsed = false, compact = false }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tasksTab') === 'history' ? 'history' : 'current';

  // Each tab pages on its own URL key, so turning a page in one never moves the other.
  const current = useCursorPagination({ urlKey: 'curCursor' });
  const history = useCursorPagination({ urlKey: 'histCursor' });

  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const { data: baseline } = useReportingBaseline();
  // History starts from the later of 30 days ago and the reporting start date, so it never opens on records the reports leave out. Choosing a date
  // (including clearing it with All time) replaces that default until Reset.
  const thirtyDaysAgo = daysAgoIso(DEFAULT_HISTORY_DAYS);
  const defaultFrom = baseline && baseline > thirtyDaysAgo ? baseline : thirtyDaysAgo;
  const [chosenFrom, setChosenFrom] = useState<string | null>(null);
  const dateFrom = chosenFrom ?? defaultFrom;
  const setDateFrom = (value: string) => setChosenFrom(value);
  const [dateTo, setDateTo] = useState('');

  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'history') params.set('tasksTab', 'history'); else params.delete('tasksTab');
    setSearchParams(params, { replace: true });
  };

  // No chip selected means no narrowing: every History status.
  const historyStatuses = statuses.length > 0 ? statuses : HISTORY_STATUSES;
  const includesDone = historyStatuses.includes('done');

  const { data: currentTasks, isLoading: currentLoading } = useTaskList(
    { assigneeId, statuses: CURRENT_STATUSES, limit: 50, cursor: current.cursor },
    tab === 'current' && !collapsed,
  );
  const { data: historyTasks, isLoading: historyLoading } = useTaskList(
    {
      assigneeId,
      statuses: historyStatuses.map((s) => s.toLowerCase()).join(','),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      // Lists leave out finished work from before the reporting start date; asking for dates that reach back past it (All time, or an earlier From) includes it.
      includeBeforeReportingStart: baseline && (!dateFrom || dateFrom < baseline) ? true : undefined,
      // Finished work reads newest completion first (any unfinished work follows it); a list with nothing finished in it has no completion dates, so by due date.
      sortBy: includesDone ? 'actualEndDate' : 'dueDate',
      sortDirection: 'desc',
      limit: 50,
      cursor: history.cursor,
    },
    tab === 'history' && !collapsed,
  );
  // What the Current tab leaves out, so it can say so rather than hiding it. Capped at one page: a count past it reads "100+".
  const { data: leftOut } = useTaskList(
    { assigneeId, statuses: LEFT_OUT_STATUSES.map((s) => s.toLowerCase()).join(','), limit: 100 },
    tab === 'current' && !collapsed,
  );

  const toggleStatus = (status: TaskStatus) => {
    setStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
    history.reset();
  };
  const changeDate = (set: (v: string) => void, value: string) => { set(value); history.reset(); };
  const filtered = statuses.length > 0 || chosenFrom !== null || dateTo !== '';

  const leftOutItems = leftOut?.items ?? [];
  const leftOutParts = LEFT_OUT_STATUSES
    .map((s) => ({ s, n: leftOutItems.filter((t) => t.status === s).length }))
    .filter((p) => p.n > 0)
    .map((p) => `${p.n}${leftOut?.hasMore ? '+' : ''} ${STATUS_LABEL[p.s]}`);

  const renderTask = (task: TaskDto) => {
    const days = daysLate(task);
    const isDone = task.status === 'done';
    return (
      <li key={task.id} className={cn('flex items-center gap-3 transition-colors hover:bg-muted/40', compact ? 'px-4 py-2.5' : 'px-5 py-3')}>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onPreview(task.id)}
            className={cn(
              'block w-full truncate text-left text-sm font-medium hover:text-primary',
              isDone ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {task.taskKey && <span className="font-mono text-xs text-muted-foreground">{task.taskKey} </span>}
            {task.title}
          </button>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {task.projectName && <span>{task.projectName} · </span>}
            {isDone && task.actualEndDate ? `Completed ${formatDate(task.actualEndDate)}` : `Due ${formatDate(task.dueDate)}`}
            {task.status === 'paused' && task.pausedAt && (
              <span className="ml-1.5 font-medium text-amber-600">· paused {workingDaysSince(task.pausedAt)} working days</span>
            )}
            {task.status === 'backlog' && !(task.points > 0) && (
              <span className="ml-1.5 font-medium text-amber-600">· needs an estimate before time can be logged</span>
            )}
            {!isDone && days !== null && days <= 1 && (
              <span className="ml-1.5 font-medium text-red-600">
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? '· due today' : '· due tomorrow'}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{task.points}pt</span>
          <Badge label={STATUS_LABEL[task.status]} variant={STATUS_VARIANT[task.status]} />
        </div>
      </li>
    );
  };

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`engineer-tasks-tab-${value}`}
      aria-selected={tab === value}
      aria-controls="engineer-tasks-panel"
      onClick={() => selectTab(value)}
      className={cn(
        '-mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors',
        tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  const list = tab === 'current' ? currentTasks : historyTasks;
  const loading = tab === 'current' ? currentLoading : historyLoading;
  const pager = tab === 'current' ? current : history;
  const items = list?.items ?? [];

  return (
    <Card className={cn('overflow-hidden', !compact && 'mb-5')}>
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <CheckSquare className="h-4 w-4 text-primary" />
        </div>
        {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
        {!collapsed && (
          <div role="tablist" aria-label="Tasks" className="flex items-center gap-1">
            {tabButton('current', 'Current')}
            {tabButton('history', 'History')}
          </div>
        )}
        {headerExtra && <div className="ml-auto flex items-center gap-2 py-2">{headerExtra}</div>}
      </div>

      {!collapsed && tab === 'history' && (
        <div className="space-y-2 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status">
            {HISTORY_STATUSES.map((s) => {
              const on = statuses.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">
              From
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => changeDate(setDateFrom, e.target.value)} className={cn(FILTER_INPUT, 'rounded-md border border-border')} />
            </label>
            <label className="flex items-center gap-1.5">
              To
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => changeDate(setDateTo, e.target.value)} className={cn(FILTER_INPUT, 'rounded-md border border-border')} />
            </label>
            {baseline && (
              <button type="button" onClick={() => changeDate(setDateFrom, baseline)} className="hover:text-primary hover:underline">
                From reporting start
              </button>
            )}
            <button type="button" onClick={() => changeDate(setDateFrom, '')} className="hover:text-primary hover:underline">
              All time
            </button>
            {filtered && (
              <button
                type="button"
                onClick={() => { setStatuses([]); setChosenFrom(null); setDateTo(''); history.reset(); }}
                className="ml-auto hover:text-primary hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Date means when a task was completed, or its due date if it is not done. Backlog work with no due date is always shown.
          </p>
        </div>
      )}

      {!collapsed && (
      <div role="tabpanel" id="engineer-tasks-panel" aria-labelledby={`engineer-tasks-tab-${tab}`}>
        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5"><Skeleton className="h-10 w-full" /></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            {tab === 'current' ? 'No tasks in progress.' : 'No tasks match these filters.'}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border">{items.map(renderTask)}</ul>
        )}

        {tab === 'current' && leftOutParts.length > 0 && (
          <p className="border-t border-border bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
            Not counted in workload: {leftOutParts.join(', ')}.{' '}
            <button type="button" onClick={() => selectTab('history')} className="font-medium text-primary hover:underline">See History</button>
          </p>
        )}

        {!loading && (pager.hasPrev || list?.hasMore) && (
          <div className="px-4 pb-3">
            <Pagination
              page={pager.pageNumber}
              hasPrev={pager.hasPrev}
              hasMore={list?.hasMore ?? false}
              onPrev={pager.goPrev}
              onNext={() => { if (list?.nextCursor) pager.goNext(list.nextCursor); }}
            />
          </div>
        )}
      </div>
      )}
    </Card>
  );
}
