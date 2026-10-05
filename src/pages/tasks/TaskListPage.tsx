import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckSquare, Layers, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { FilterBar, FILTER_SELECT } from '../../components/ui/FilterBar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Pagination } from '../../components/ui/Pagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useTaskList, useBulkReassign, useBulkStatusChange, type TaskListParams } from '../../api/tasks';
import { useProjectList, useMyProjects } from '../../api/projects';
import { useEngineerList, useEngineer } from '../../api/engineers';
import { useEscalations } from '../../api/escalations';
import { useEpicsByProject } from '../../api/epics';
import { useMeta } from '../../api/meta';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDate, daysLate } from '../../lib/dates';
import { formatPtsDays } from '../../lib/points';
import { backlogExitHint } from '../../lib/taskStatus';
import type { EscalationLevel, TaskDto, TaskStatus, TaskType } from '../../types/api';

export type TaskSortBy = NonNullable<TaskListParams['sortBy']>;

const PAGE_SIZE = 20;

// Explicit opt-in for the org-wide, unscoped view — distinct from '' (no project chosen yet),
// which now shows a prompt instead of silently running the heaviest possible query by default.
const ALL_PROJECTS = '__all__';
// HR/Accountant only: everything assigned to me — including personal tasks, which live in a hidden
// project of their own and so can't be picked from the project list.
const MY_TASKS = '__mine__';

const STATUS_VARIANT: Record<TaskStatus, 'green' | 'red' | 'gray' | 'yellow'> = {
  backlog: 'gray', active: 'green', blocked: 'red', inQa: 'gray', done: 'gray', paused: 'yellow',
};
const ESC_VARIANT: Record<EscalationLevel, 'yellow' | 'red'> = {
  TMinus3: 'yellow', TMinus1: 'red', Overdue: 'red',
};
const ESC_LABEL: Record<EscalationLevel, string> = {
  TMinus3: 'T-3', TMinus1: 'T-1', Overdue: 'Overdue',
};


const DISCIPLINES = [
  { value: 'frontend',  label: 'Frontend' },
  { value: 'backend',   label: 'Backend' },
  { value: 'design',    label: 'Design' },
  { value: 'fullStack', label: 'Full Stack' },
  { value: 'product',   label: 'Product' },
  { value: 'pmo',       label: 'PMO' },
  { value: 'functional', label: 'Functional' },
  { value: 'database', label: 'Database' },
  { value: 'infraDevSecOps', label: 'Infra/DevSecOps' },
  { value: 'support',   label: 'Support' },
  { value: 'other',     label: 'Other' },
];

export default function TaskListPage() {
  const { allow, currentUser } = useAuth();
  const navigate = useNavigate();
  const isPm       = allow('pm-or-above');
  const canFilterByAssignee = allow('team-lead-or-above');
  const isEngineer = currentUser?.role === 'engineer' || currentUser?.role === 'designer';
  const canPersonal = allow('personal-task-creator');
  const { data: meta }        = useMeta();
  const { data: myEngineer }  = useEngineer(currentUser!.id);

  const [filters, setFilter, setFilters, clearUrlFilters] = useUrlFilters({
    projectId: canPersonal ? MY_TASKS : '', assigneeId: '', status: '', taskType: '', discipline: '', search: '', groupByEpic: 'false',
    sortBy: '', sortDirection: '',
  }, ['cursor', 'cursorPage']);
  const { projectId, assigneeId, status, discipline, search } = filters;
  const sortBy = filters.sortBy as TaskSortBy | '';
  const sortDirection = filters.sortDirection === 'desc' ? 'desc' : 'asc';

  const toggleSort = (column: TaskSortBy) => {
    if (sortBy === column) {
      setFilter('sortDirection', sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setFilters({ sortBy: column, sortDirection: 'asc' });
    }
  };
  const taskType     = filters.taskType as TaskType | '';
  const groupByEpic  = filters.groupByEpic === 'true';
  const [disciplineInitialized, setDisciplineInitialized] = useState(false);
  const [searchInput,           setSearchInput]           = useState(filters.search);
  const [selectedIds,           setSelectedIds]           = useState<Set<string>>(new Set());
  const [bulkTarget,            setBulkTarget]            = useState('');
  const [previewTaskId,         setPreviewTaskId]         = useState<string | null>(null);
  const { cursor: currentCursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination();

  // Default discipline filter to the engineer's own discipline on first load — skipped if the
  // URL already carries a discipline (a deep link or navigate-back shouldn't be clobbered).
  useEffect(() => {
    if (!disciplineInitialized && myEngineer && isEngineer) {
      if (!discipline) setFilter('discipline', myEngineer.discipline ?? '');
      setDisciplineInitialized(true);
    }
  }, [myEngineer, disciplineInitialized, isEngineer]);

  useEffect(() => {
    const t = setTimeout(() => { setFilter('search', searchInput); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // A single, explicit project scope — everything else (grouping by epic, the epics lookup)
  // assumes exactly one project, and 'All projects' isn't one.
  const isSingleProject = !!projectId && projectId !== ALL_PROJECTS && projectId !== MY_TASKS;
  const hasProjectScope = !!projectId;

  const { data: tasks, isLoading, error, refetch } = useTaskList({
    projectId:  isSingleProject ? projectId : undefined,
    assigneeId: projectId === MY_TASKS ? currentUser!.id : (assigneeId || undefined),
    status:     status     || undefined,
    taskType:   taskType   || undefined,
    discipline: discipline || undefined,
    title:      search     || undefined,
    cursor:     currentCursor,
    limit:      PAGE_SIZE,
    sortBy:        sortBy || undefined,
    sortDirection: sortBy ? sortDirection : undefined,
  }, hasProjectScope);

  const { data: allProjects }  = useProjectList();
  const { data: myProjects }   = useMyProjects();
  // Engineers and designers see only their accessible projects; managers see all
  // (minus ones outside their own department, which they can't actually open).
  const projects = isEngineer ? myProjects : allProjects?.filter((p) => p.canAccess);
  const { data: engineers }   = useEngineerList();
  const { data: escalations } = useEscalations(allow('team-lead-or-above') || allow('executive-read') || allow('hr-read'));
  const { data: epics }       = useEpicsByProject(isSingleProject ? projectId : '');
  const bulkReassign          = useBulkReassign();
  const bulkStatusChange      = useBulkStatusChange();

  const escalationMap = useMemo(() => {
    const m = new Map<string, EscalationLevel>();
    escalations?.forEach((e) => m.set(e.taskId, e.level));
    return m;
  }, [escalations]);

  const items         = tasks?.items ?? [];
  const allSelectable = items.filter((t) => t.status !== 'done');
  const allSelected   = allSelectable.length > 0 && allSelectable.every((t) => selectedIds.has(t.id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allSelectable.map((t) => t.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkReassign = () => {
    if (!bulkTarget) { toast.error('Select a target engineer first.'); return; }
    bulkReassign.mutate(
      { taskIds: Array.from(selectedIds), targetEngineerId: bulkTarget },
      {
        onSuccess: (result) => {
          const eng = engineers?.find((e) => e.id === bulkTarget)?.name ?? 'engineer';
          if (result.triggeredOverworkWarning) {
            toast.warning(`${result.tasksReassigned} tasks moved to ${eng}. ⚠ Overwork signals tripped.`);
          } else {
            toast.success(`${result.tasksReassigned} tasks reassigned to ${eng}.`);
          }
          setSelectedIds(new Set()); setBulkTarget('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Reassign failed.'),
      },
    );
  };

  const epicMap = useMemo(() => new Map((epics ?? []).map((e) => [e.id, e.title])), [epics]);

  const groupedItems = useMemo(() => {
    if (!groupByEpic || !isSingleProject) return null;
    const groups = new Map<string | null, TaskDto[]>();
    for (const task of (tasks?.items ?? [])) {
      const key = task.epicId ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (epicMap.get(a) ?? '').localeCompare(epicMap.get(b) ?? '');
    });
  }, [groupByEpic, projectId, tasks, epicMap]);

  const hasFilters = !!((projectId && projectId !== ALL_PROJECTS && projectId !== MY_TASKS) || assigneeId || status || taskType || search || discipline);
  const clearFilters = () => {
    clearUrlFilters();
    setSearchInput('');
  };

  const taskRow = (task: TaskDto) => {
    const days     = daysLate(task);
    const esc      = escalationMap.get(task.id);
    const daysEst  = formatPtsDays(task.points, engineers?.find(e => e.id === task.assigneeId));
    return (
      <TableRow
        key={task.id}
        className={cn('cursor-pointer', selectedIds.has(task.id) && 'bg-primary/5')}
        onClick={() => setPreviewTaskId(task.id)}
      >
        {isPm && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            {task.status !== 'done' && (
              <input
                type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleOne(task.id)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                aria-label={`Select ${task.title}`}
              />
            )}
          </TableCell>
        )}
        <TableCell>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.taskKey && (
              <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">{task.taskKey}</span>
            )}
            <Link to={`/tasks/${task.id}`} className="font-medium text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
              {task.title}
            </Link>
            {esc && <Badge label={ESC_LABEL[esc]} variant={ESC_VARIANT[esc]} />}
          </div>
          {task.blockerReason && (
            <p className="mt-0.5 truncate text-xs text-destructive">{task.blockerReason}</p>
          )}
          {!!task.subtasksTotal && (
            <p className="mt-0.5 text-xs text-muted-foreground">{task.subtasksDone}/{task.subtasksTotal} subtasks</p>
          )}
        </TableCell>
        <TableCell className="hidden text-muted-foreground xl:table-cell">{task.projectName ?? '—'}</TableCell>
        <TableCell className="text-muted-foreground">
          {task.assigneeName ?? '—'}
          {task.creatorName && <p className="text-xs text-muted-foreground/70">by {task.creatorName}</p>}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Badge label={task.status} variant={STATUS_VARIANT[task.status]} />
            {task.status === 'backlog' && (
              <HelpTooltip title="How to get out of Backlog" body={backlogExitHint(!!task.assigneeId, task.points)} />
            )}
            {task.requiresFrontendHandoff && task.status !== 'done' && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">
                In: {task.currentStage === 'frontend' ? 'Frontend' : 'Backend'}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap font-mono tabular-nums text-muted-foreground">
          {formatDate(task.dueDate)}
          {days !== null && days < 0 && <span className="ml-1 text-xs text-destructive">({Math.abs(days)}d late)</span>}
        </TableCell>
        <TableCell className="hidden whitespace-nowrap font-mono tabular-nums text-muted-foreground xl:table-cell">{formatDate(task.actualEndDate)}</TableCell>
        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
          {task.points}
          {daysEst && <span className="ml-1 text-xs text-muted-foreground/70">{daysEst}</span>}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        actions={<Button size="sm" onClick={() => navigate('/tasks/new')}>New task</Button>}
      />

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        {/* Search */}
        <FilterBar.Item label="Search">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Task name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent pl-7 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-44"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setFilter('search', ''); }} className="absolute right-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="Project">
          <SearchableSelect
            value={projectId}
            onChange={(v) => setFilters({ projectId: v, groupByEpic: 'false' })}
            placeholder="Select a project…"
            emptyLabel="No matching projects"
            options={[
              ...(canPersonal ? [{ value: MY_TASKS, label: 'My tasks (incl. personal)' }] : []),
              { value: ALL_PROJECTS, label: 'All projects' },
              ...(projects?.map((p) => ({ value: p.id, label: p.name })) ?? []),
            ]}
          />
        </FilterBar.Item>
        {canFilterByAssignee && (
          <>
            <FilterBar.Divider />
            <FilterBar.Item label="Assignee">
              <SearchableSelect
                value={assigneeId}
                onChange={(v) => setFilter('assigneeId', v)}
                placeholder="Search engineers…"
                emptyLabel="No matching engineers"
                options={[{ value: '', label: 'All' }, ...(engineers?.map((e) => ({ value: e.id, label: e.name })) ?? [])]}
              />
            </FilterBar.Item>
          </>
        )}
        <FilterBar.Divider />
        <FilterBar.Item label="Status">
          <select className={FILTER_SELECT} value={status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All</option>
            {(meta?.taskStatuses ?? []).map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="Type">
          <select className={FILTER_SELECT} value={taskType} onChange={(e) => setFilter('taskType', e.target.value)}>
            <option value="">All</option>
            {(meta?.taskTypes ?? []).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="Discipline">
          <SearchableSelect
            className="w-36"
            value={discipline}
            onChange={(v) => setFilter('discipline', v)}
            placeholder="Search…"
            emptyLabel="No matching disciplines"
            options={[{ value: '', label: 'All' }, ...DISCIPLINES]}
          />
        </FilterBar.Item>
        {isSingleProject && (
          <>
            <FilterBar.Divider />
            <button
              onClick={() => setFilter('groupByEpic', groupByEpic ? 'false' : 'true')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                groupByEpic
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-input bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Group by epic
            </button>
          </>
        )}
      </FilterBar>

      {!hasProjectScope && (
        <Card>
          <EmptyState
            icon={Layers}
            title="Select a project to view its tasks"
            description="Pick a project above, or choose 'All projects' for the org-wide view."
            action={
              <button onClick={() => setFilter('projectId', ALL_PROJECTS)} className="text-xs text-primary hover:underline">
                View all projects
              </button>
            }
          />
        </Card>
      )}

      {hasProjectScope && isLoading && <TablePageSkeleton cols={7} hasAction={false} />}
      {hasProjectScope && error     && <ErrorState error={error} onRetry={refetch} />}

      {hasProjectScope && !isLoading && !error && (
        <Card>
          {items.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title={hasFilters ? 'No tasks match your filters' : 'No tasks yet'}
              description={hasFilters ? 'Try adjusting or clearing your filters.' : 'Create a task to get started.'}
              action={
                hasFilters
                  ? <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
                  : <Button size="sm" onClick={() => navigate('/tasks/new')}>New task</Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {items.length === PAGE_SIZE ? `${items.length}+ tasks` : `${items.length} task${items.length !== 1 ? 's' : ''}`}
                  {hasFilters && <span className="ml-1 text-primary">· filtered</span>}
                </span>
                {pageNumber > 1 && <span className="text-xs text-muted-foreground">Page {pageNumber}</span>}
              </div>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isPm && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                        aria-label="Select all tasks"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[36%] xl:w-[30%]">
                    <SortableHeader label="Title" column="title" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                  </TableHead>
                  <TableHead className="hidden w-[12%] xl:table-cell">Project</TableHead>
                  <TableHead className="w-[16%]">Assignee</TableHead>
                  <TableHead className="w-[10%]">
                    <SortableHeader label="Status" column="status" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                  </TableHead>
                  <TableHead className="w-[12%]">
                    <SortableHeader label="Due" column="dueDate" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                  </TableHead>
                  <TableHead className="hidden w-[12%] xl:table-cell">
                    <SortableHeader label="Actual" column="actualEndDate" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                  </TableHead>
                  <TableHead className="w-[8%] text-right">
                    <SortableHeader label="Pts" column="points" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} align="right" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedItems
                  ? groupedItems.flatMap(([epicId, epicTasks]) => {
                      const epicTitle = epicId ? (epicMap.get(epicId) ?? `Epic …${epicId.slice(-6)}`) : 'No epic';
                      const colSpan = isPm ? 8 : 7;
                      return [
                        <TableRow key={`group-${epicId}`} className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={colSpan} className="py-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                              {epicTitle}
                              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{epicTasks.length}</span>
                            </span>
                          </TableCell>
                        </TableRow>,
                        ...epicTasks.map((task) => taskRow(task)),
                      ];
                    })
                  : items.map((task) => taskRow(task))
                }
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </Card>
      )}

      {hasProjectScope && !isLoading && !error && (
        <Pagination
          hasPrev={hasPrev}
          hasMore={tasks?.hasMore ?? false}
          page={pageNumber}
          onPrev={() => { setSelectedIds(new Set()); goPrev(); }}
          onNext={() => { if (tasks?.nextCursor) { setSelectedIds(new Set()); goNext(tasks.nextCursor); } }}
        />
      )}

      {/* Bulk action bar */}
      {isPm && selectedIds.size > 0 && (
        // lg:left-60 = the sidebar's width: the bar is fixed to the screen, so on desktop it starts where the content does.
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card px-6 py-3 shadow-lg lg:left-60">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
            <span className="text-sm font-medium shrink-0">
              {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkStatusChange.mutate(
                  { taskIds: Array.from(selectedIds), targetStatus: 'done' },
                  {
                    onSuccess: (count) => { toast.success(`${count} task${count !== 1 ? 's' : ''} marked done.`); setSelectedIds(new Set()); },
                    onError:   () => toast.error('Bulk status change failed.'),
                  },
                )}
                loading={bulkStatusChange.isPending}
              >
                Mark done
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkStatusChange.mutate(
                  { taskIds: Array.from(selectedIds), targetStatus: 'active' },
                  {
                    onSuccess: (count) => { toast.success(`${count} blocker${count !== 1 ? 's' : ''} cleared.`); setSelectedIds(new Set()); },
                    onError:   () => toast.error('Bulk status change failed.'),
                  },
                )}
                loading={bulkStatusChange.isPending}
              >
                Clear blockers
              </Button>
              <div className="mx-2 h-5 w-px bg-border" />
              <SearchableSelect
                value={bulkTarget}
                onChange={setBulkTarget}
                placeholder="Reassign to…"
                emptyLabel="No matching engineers"
                className="w-44"
                options={engineers?.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.name })) ?? []}
              />
              <Button size="sm" onClick={handleBulkReassign} loading={bulkReassign.isPending} disabled={!bulkTarget}>
                Reassign
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedIds(new Set()); setBulkTarget(''); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}

export function SortableHeader({ label, column, sortBy, sortDirection, onSort, align = 'left' }: {
  label: string;
  column: TaskSortBy;
  sortBy: TaskSortBy | '';
  sortDirection: 'asc' | 'desc';
  onSort: (column: TaskSortBy) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortBy === column;
  const Icon = isActive ? (sortDirection === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${isActive ? 'text-foreground' : 'text-muted-foreground'} ${align === 'right' ? 'flex-row-reverse' : ''}`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
