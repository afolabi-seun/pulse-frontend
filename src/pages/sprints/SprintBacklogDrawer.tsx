import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Check, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Button from '../../components/ui/Button';
import { cn } from '@/lib/utils';
import { useTaskList, useAssignTasksToSprint } from '../../api/tasks';
import { useEpicsByProject } from '../../api/epics';
import { useProjectList } from '../../api/projects';
import { useEngineerList } from '../../api/engineers';
import { formatDate } from '../../lib/dates';
import { formatPtsDays } from '../../lib/points';
import type { TaskDto } from '../../types/api';

const TYPE_CLS: Record<string, string> = {
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  bug:     'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  test:    'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  review:  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  chore:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface Props {
  open: boolean;
  onClose: () => void;
  sprintId: string;
  teamId: string;
}

export default function SprintBacklogDrawer({ open, onClose, sprintId, teamId }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: allProjects } = useProjectList();
  // Scope to only projects owned by this sprint's team, that the viewer can actually open
  const projects = useMemo(
    () => (allProjects ?? []).filter((p) => p.ownerTeamId === teamId && p.canAccess),
    [allProjects, teamId],
  );

  // Default to the team's first project when the list first loads
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const { data: engineers } = useEngineerList();
  const { data: tasks }     = useTaskList({
    projectId: selectedProjectId || undefined,
    noSprint:  true,
    limit:     100,
  });
  const { data: epics } = useEpicsByProject(selectedProjectId);
  const assignTasks = useAssignTasksToSprint();

  const epicMap = useMemo(
    () => new Map((epics ?? []).map((e) => [e.id, e.title])),
    [epics],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (tasks?.items ?? []).filter((t) => !q || t.title.toLowerCase().includes(q));
  }, [tasks, search]);

  const grouped = useMemo(() => {
    const map = new Map<string | null, TaskDto[]>();
    for (const t of filtered) {
      const key = t.epicId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (epicMap.get(a) ?? '').localeCompare(epicMap.get(b) ?? '');
    });
  }, [filtered, epicMap]);

  // Epic label: use resolved title if available, otherwise a short ID fragment
  const epicLabel = (epicId: string | null): string => {
    if (!epicId) return 'No epic';
    const title = epicMap.get(epicId);
    if (title) return title;
    // No project selected — epic title unavailable, show short ID
    return `Epic …${epicId.slice(-6)}`;
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupTasks: TaskDto[]) => {
    const ids = groupTasks.map((t) => t.id);
    if (ids.length === 0) return;
    const allSel = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      allSel ? ids.forEach((id) => next.delete(id)) : ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleAdd = () => {
    const taskIds = [...selected];
    assignTasks.mutate(
      { taskIds, sprintId },
      {
        onSuccess: () => {
          toast.success(`${taskIds.length} task${taskIds.length !== 1 ? 's' : ''} added to sprint.`);
          setSelected(new Set());
          onClose();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add tasks.'),
      },
    );
  };

  const handleClose = () => { setSelected(new Set()); setSearch(''); setSelectedProjectId(projects[0]?.id ?? ''); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Add from backlog</DialogTitle>
            {selected.size > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {selected.size} selected
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-3 border-b border-border px-6 py-3">
          {projects.length > 1 && (
            <select
              value={selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); setSelected(new Set()); }}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tasks ? 'No backlog tasks found.' : 'Loading…'}
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([epicId, groupTasks]) => {
                const label = epicLabel(epicId);
                const allSel = groupTasks.length > 0 && groupTasks.every((t) => selected.has(t.id));

                return (
                  <div key={epicId ?? '__none__'}>
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupTasks)}
                      className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-60"
                    >
                      <span className={cn(
                        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        allSel ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                      )}>
                        {allSel && <Check className="h-2.5 w-2.5" />}
                      </span>
                      {label}
                      <span className="font-normal text-muted-foreground/60">({groupTasks.length})</span>
                    </button>

                    {/* Tasks */}
                    <div className="space-y-1.5 pl-6">
                      {groupTasks.map((task) => {
                        const isSel = selected.has(task.id);

                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => toggle(task.id)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-md border p-2.5 text-left transition-colors',
                              isSel
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border bg-card hover:bg-muted/40',
                            )}
                          >
                            <span className={cn(
                              'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                            )}>
                              {isSel && <Check className="h-2.5 w-2.5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  TYPE_CLS[task.taskType] ?? 'bg-muted text-muted-foreground',
                                )}>
                                  {task.taskType}
                                </span>
                                {task.taskKey && <span className="font-mono text-xs text-muted-foreground">{task.taskKey}</span>}
                                <span className="text-sm font-medium text-foreground leading-snug">{task.title}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {task.points} pts
                                {(() => { const d = formatPtsDays(task.points, engineers?.find(e => e.id === task.assigneeId)); return d ? ` · ${d}` : ''; })()}
                                {task.dueDate
                                  ? ` · due ${formatDate(task.dueDate)}`
                                  : <span className="ml-1 text-muted-foreground/70">· due date will follow the sprint's end date</span>
                                }
                                {!!task.subtasksTotal && ` · ${task.subtasksDone}/${task.subtasksTotal} subtasks`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
            <Button
              size="sm"
              type="button"
              disabled={selected.size === 0}
              loading={assignTasks.isPending}
              onClick={handleAdd}
            >
              Add {selected.size > 0 ? `${selected.size} ` : ''}task{selected.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
