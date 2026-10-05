import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowUpRight, FlaskConical, XCircle, GitPullRequest } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTask, useMarkTaskDone, useSendToQa, useClearBlocker, useResumeTask, useSubtasks, useToggleSubtask, useTaskMentionCandidates, useApprovePrApproval, useRejectPrApproval } from '../../api/tasks';
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/ui/ErrorState';
import { RichTextContent } from '@/components/ui/rich-text-content';
import CommentsThread from './CommentsThread';
import PriorityBadge from './PriorityBadge';
import { STATUS_VARIANT, STATUS_LABEL, SEVERITY_COLORS } from '../../lib/taskStatus';
import { formatDate } from '../../lib/dates';
import { cn } from '@/lib/utils';

// Matches CommentsThread's own collapsible header below — same ▼/▲ language, same
// "count/state stays visible in the header even collapsed" idea.
function CollapsibleSection({ label, defaultOpen, children }: {
  label: string; defaultOpen: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{open ? '▼' : '▲'}</span>
      </button>
      {open && children}
    </div>
  );
}

export default function TaskPreviewDrawer({ taskId, onClose, nonModal = false }: {
  taskId: string | null; onClose: () => void;
  /** Don't block the page behind the panel — lets a caller like NotificationsPage keep its list
   * clickable while the panel is open, so clicking a different row swaps the preview in place
   * instead of requiring a close-then-reopen. Every other caller keeps the normal modal sheet. */
  nonModal?: boolean;
}) {
  const { currentUser, allow } = useAuth();
  const { data: task, isLoading, error, refetch } = useTask(taskId ?? '');
  // Task-scoped, not a plain engineer list — matches TaskDetailPage's own comments/mentions and,
  // critically, always includes the task's creator even when they have no other standing project
  // access (see GetTaskMentionCandidatesQuery). The previous useEngineerList() here silently
  // dropped anyone outside that access boundary from being mentionable in this drawer.
  const { data: engineers } = useTaskMentionCandidates(taskId ?? '');

  const markTaskDone = useMarkTaskDone(taskId ?? '');
  const sendToQa     = useSendToQa(taskId ?? '');
  const clearBlocker = useClearBlocker(taskId ?? '');
  const resumeTask   = useResumeTask(taskId ?? '');
  const approvePr    = useApprovePrApproval(taskId ?? '');
  const rejectPr     = useRejectPrApproval(taskId ?? '');
  const { data: subtasks = [] } = useSubtasks(taskId ?? '');
  const toggleSubtask = useToggleSubtask(taskId ?? '');
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  const isOwner = !!task && task.assigneeId === currentUser?.id;
  const canEdit = allow('pm-or-above');
  const canAct  = isOwner || canEdit;
  const canManageSubtasks = isOwner || allow('team-lead-or-above');
  const subtasksDone = subtasks.filter((s) => s.isDone).length;

  const handleMarkDone = () =>
    markTaskDone.mutate(undefined, { onSuccess: () => toast.success('Status updated.') });

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }} modal={!nonModal}>
      <SheetContent
        overlay={!nonModal}
        // Non-modal mode is specifically so clicking a different row in the list behind the
        // panel swaps its content — Radix's default "outside click closes" would fight that by
        // closing the panel first (a race against the row's own click handler). Escape and the
        // explicit close button still work; only stray outside pointer-downs are suppressed.
        onPointerDownOutside={nonModal ? (e) => e.preventDefault() : undefined}
      >
        <SheetHeader>
          {task ? (
            <>
              <SheetTitle>{task.title}</SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {task.taskKey && <span className="font-mono">{task.taskKey}</span>}
                {task.taskKey && task.projectName && ' · '}
                {task.projectName}
              </p>
            </>
          ) : (
            <SheetTitle>Task</SheetTitle>
          )}
        </SheetHeader>

        <SheetBody>
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : isLoading || !task ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge label={STATUS_LABEL[task.status]} variant={STATUS_VARIANT[task.status]} />
                {task.status === 'inQa' && (
                  <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">
                    <FlaskConical className="h-3 w-3" /> Awaiting QA review
                  </span>
                )}
                {task.pendingPrApprovalRequestedAt && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    <GitPullRequest className="h-3 w-3" /> PR pending approval
                  </span>
                )}
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{task.taskType}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{task.points} pts</span>
                {task.severity && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', SEVERITY_COLORS[task.severity])}>
                    {task.severity}
                  </span>
                )}
                <PriorityBadge priority={task.priority} />
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assignee</p>
                  <p className="mt-0.5 text-foreground">{task.assigneeName ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due date</p>
                  <p className="mt-0.5 text-foreground">{formatDate(task.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created by</p>
                  <p className="mt-0.5 text-foreground">{task.creatorName ?? '—'}</p>
                </div>
              </div>

              {task.description && (
                <CollapsibleSection label="Description" defaultOpen>
                  <RichTextContent html={task.description} />
                </CollapsibleSection>
              )}

              {task.acceptanceCriteria && (
                <CollapsibleSection label="Acceptance criteria" defaultOpen>
                  <RichTextContent html={task.acceptanceCriteria} />
                </CollapsibleSection>
              )}

              {task.blockerReason && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Blocker</p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-400">{task.blockerReason}</p>
                </div>
              )}

              {task.reactivationReason && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">Returned from QA</p>
                  <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">{task.reactivationReason}</p>
                </div>
              )}

              {(canAct && task.status !== 'done') && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  {task.status === 'active' && !task.parentTaskId && (
                    task.requiresQa ? (
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => sendToQa.mutate(undefined, {
                          onSuccess: () => toast.success('Task sent to QA. QA sub-task created.'),
                          onError:   (e) => toast.error((e as Error).message ?? 'Failed to send to QA.'),
                        })}
                        loading={sendToQa.isPending}
                      >
                        <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                        Send to QA
                      </Button>
                    ) : (
                      <Button
                        variant="secondary" size="sm"
                        onClick={handleMarkDone}
                        loading={markTaskDone.isPending}
                        disabled={task.requiresPrApproval && !task.prApprovedAt}
                        title={task.requiresPrApproval && !task.prApprovedAt ? 'This task requires PR approval sign-off first.' : undefined}
                      >
                        Mark done
                      </Button>
                    )
                  )}
                  {task.pendingPrApprovalRequestedAt && task.canApprovePrApproval && (
                    <>
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => approvePr.mutate(undefined, { onSuccess: () => toast.success('PR approved.') })}
                        loading={approvePr.isPending}
                      >
                        <GitPullRequest className="mr-1.5 h-3.5 w-3.5" />
                        Approve PR
                      </Button>
                      <Button
                        variant="danger" size="sm"
                        onClick={() => rejectPr.mutate(undefined, { onSuccess: () => toast.success('PR rejected.') })}
                        loading={rejectPr.isPending}
                      >
                        Reject PR
                      </Button>
                      <Link to={`/tasks/${taskId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        Reassign approver on full page
                      </Link>
                    </>
                  )}
                  {task.status === 'blocked' && (
                    <Button variant="secondary" size="sm" onClick={() => clearBlocker.mutate(undefined, { onSuccess: () => toast.success('Blocker cleared.') })} loading={clearBlocker.isPending}>
                      Clear blocker
                    </Button>
                  )}
                  {task.status === 'paused' && (
                    <Button variant="secondary" size="sm" onClick={() => resumeTask.mutate(undefined, { onSuccess: () => toast.success('Task resumed.') })} loading={resumeTask.isPending}>
                      Resume task
                    </Button>
                  )}
                  {task.parentTaskId && task.status === 'active' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={handleMarkDone} loading={markTaskDone.isPending}>
                        Accept (QA passed)
                      </Button>
                      <Link to={`/tasks/${taskId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <XCircle className="h-3.5 w-3.5" /> Reject on full page
                      </Link>
                    </>
                  )}
                </div>
              )}

              {subtasks.length > 0 && (
                <div className="mb-4 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setSubtasksOpen((v) => !v)}
                    className="mb-1.5 flex w-full items-center justify-between text-left"
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subtasks</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{subtasksDone}/{subtasks.length}</span>
                      <span className="text-xs text-muted-foreground">{subtasksOpen ? '▼' : '▲'}</span>
                    </span>
                  </button>
                  {subtasksOpen && (
                    <>
                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.round((subtasksDone / subtasks.length) * 100)}%` }}
                        />
                      </div>
                      <ul className="space-y-0.5">
                        {subtasks.map((s) => (
                          <li key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                            <input
                              type="checkbox"
                              checked={s.isDone}
                              disabled={!canManageSubtasks || toggleSubtask.isPending}
                              onChange={(e) => toggleSubtask.mutate({ subtaskId: s.id, isDone: e.target.checked })}
                              className="h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <span className={cn('flex-1 text-sm', s.isDone && 'text-muted-foreground line-through')}>
                              {s.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <CommentsThread taskId={task.id} currentUserId={currentUser!.id} canModerate={canEdit} engineers={engineers} />
            </>
          )}
        </SheetBody>

        {task && (
          <SheetFooter>
            <Link
              to={`/tasks/${task.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open full page <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
