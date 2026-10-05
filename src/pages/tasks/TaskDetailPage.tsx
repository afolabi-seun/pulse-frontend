import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller, type UseFormRegisterReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { AlertTriangle, Link2, X, Shuffle, FlaskConical, XCircle, Info, Undo2, Pause, Sparkles, UserPlus, ArrowLeftRight, Pencil, GitPullRequest } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTask, useUpdateTask, useDeleteTask, useFlagBlocker, useClearBlocker, usePauseTask, useResumeTask, useReturnTaskToBacklog, usePreviewAssign, useAssignTask, useLoanTask, useRecallTask, useTaskDependencies, useAddDependency, useRemoveDependency, useTaskList, useSendToQa, useQaSendCandidates, useProposeQaRejection, useConfirmQaRejection, useWithdrawQaRejection, useRespondToQaRejection, useMarkTaskDone, useGroomOwnTask, useAssigneeEditTask, useSubtasks, useAddSubtask, useToggleSubtask, useDeleteSubtask, useLoanSubtask, useRecallSubtask, useTaskMentionCandidates, useHandOffToFrontend, useHandOffToBackend, useHandoffCandidates, useRequestPrApproval, useApprovePrApproval, useRejectPrApproval, useReassignPrApprover } from '../../api/tasks';
import { useEpicsByProject } from '../../api/epics';
import { useSubmitFeedback } from '../../api/feedback';
import { useThresholds } from '../../api/thresholds';
import { useEngineerList, useEngineer, useLoanCandidates, useQaCandidates, useProjectAssignableEngineers, usePrApprovalCandidates } from '../../api/engineers';
import { useProjectList } from '../../api/projects';
import { useSprintList } from '../../api/sprints';
import { useTeamList } from '../../api/teams';
import { useEstimation, useSubmitVote, useRevealCards, useSubmitEstimateForApproval, useApproveEstimate, useRejectEstimate, useResetEstimation } from '../../api/estimation';
import CommentsThread from '../../components/tasks/CommentsThread';
import PriorityBadge from '../../components/tasks/PriorityBadge';
import PriorityScaleGuide from '../../components/tasks/PriorityScaleGuide';
import { useMeta } from '../../api/meta';
import { applyServerErrors } from '../../lib/formErrors';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import HelpTooltip from '../../components/ui/HelpTooltip';
import Button from '../../components/ui/Button';
import { DetailPageSkeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import ErrorState from '../../components/ui/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MentionTextarea from '@/components/ui/MentionTextarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { cn } from '@/lib/utils';
import { formatDate, parseDueDateEndOfDay } from '../../lib/dates';
import { formatPtsDays, pointsChangeNeedsReason } from '../../lib/points';
import { useTaskTimeSummary } from '../../api/timeEntries';
import type { TaskDto, ThresholdsDto, PreviewAssignResult, PointScaleEntryDto, EngineerDto } from '../../types/api';
import { STATUS_VARIANT, STATUS_LABEL, SEVERITY_COLORS, backlogExitHint } from '../../lib/taskStatus';

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

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

// Shared header for the stack of toggleable action cards below the main task card (Flag a
// blocker, Pause, Groom, Assign, Hand off, Loan, Edit, …) — same icon-badge treatment used on
// My Alerts/My Automations and ProjectsPage, so a form appearing here reads as part of the same
// design language rather than a plain bolded label.
const ACTION_CARD_TONE = {
  default: { box: 'bg-primary/10', icon: 'text-primary', title: 'text-foreground' },
  amber:   { box: 'bg-amber-100 dark:bg-amber-950/40', icon: 'text-amber-700 dark:text-amber-400', title: 'text-amber-700 dark:text-amber-400' },
  orange:  { box: 'bg-orange-100 dark:bg-orange-950/40', icon: 'text-orange-700 dark:text-orange-400', title: 'text-orange-700 dark:text-orange-400' },
} as const;

function ActionCardHeader({ icon: Icon, title, tone = 'default' }: {
  icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; tone?: keyof typeof ACTION_CARD_TONE;
}) {
  const t = ACTION_CARD_TONE[tone];
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', t.box)}>
        <Icon className={cn('h-4 w-4', t.icon)} />
      </div>
      <p className={cn('text-sm font-semibold', t.title)}>{title}</p>
    </div>
  );
}

function computeEscalationStatus(
  task: TaskDto, thresholds: ThresholdsDto,
): { label: string; cls: string } | null {
  // Backlog is exempt too — matches the backend's own escalation pipeline (GetEscalationCandidatesAsync
  // excludes Backlog outright), which never escalates a task that hasn't been activated yet. Without
  // this, a Backlog task's activatedAt (just its creation timestamp, not a real start date) would
  // otherwise drive a misleading "Overdue"/"T-1 reached" row here that the Escalations dashboard
  // would never agree with.
  if (task.status === 'done' || task.status === 'inQa' || task.status === 'paused' || task.status === 'backlog') return null;
  const dueDate = parseDueDateEndOfDay(task.dueDate);
  if (!dueDate) return null;
  const now       = Date.now();
  const activated = new Date(task.activatedAt).getTime();
  const due       = dueDate.getTime();
  const totalDays = (due - activated) / 86_400_000;
  const daysUntilDue = (due - now) / 86_400_000;

  if (daysUntilDue <= 0 || totalDays <= 0)
    return { label: 'Overdue', cls: 'text-destructive font-semibold' };

  const elapsedPct  = (now - activated) / (due - activated);
  const t3Threshold = Math.max(thresholds.escalationT3ElapsedPct, 1 - thresholds.escalationT3Days / totalDays);
  const t1Threshold = Math.max(thresholds.escalationT1ElapsedPct, 1 - thresholds.escalationT1Days / totalDays);
  const hoursLeft   = daysUntilDue * 24;
  const days = (n: number) => `${Math.ceil(n)} day${Math.ceil(n) === 1 ? '' : 's'}`;

  if (elapsedPct >= t1Threshold && hoursLeft >= thresholds.escalationT1MinHours)
    return { label: `T-1 reached — ${days(daysUntilDue)} left`, cls: 'text-orange-600 font-semibold' };
  if (elapsedPct >= t3Threshold && hoursLeft >= thresholds.escalationT3MinHours)
    return { label: `T-3 reached — ${days(daysUntilDue)} left`, cls: 'text-yellow-600 font-semibold' };
  const daysUntilT3 = Math.max(0, (activated + t3Threshold * totalDays * 86_400_000 - now) / 86_400_000);
  if (daysUntilT3 < 1) return { label: 'T-3 in < 1 day', cls: 'text-yellow-600' };
  return { label: `On track — T-3 in ~${Math.round(daysUntilT3)} days`, cls: 'text-muted-foreground' };
}

function SignalRow({ label, tripped, reason }: { label: string; tripped: boolean; reason: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', tripped ? 'bg-destructive' : 'bg-emerald-400')} />
      <span className="w-24 shrink-0 font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">{reason}</span>
    </div>
  );
}

function OverworkPreviewCard({ preview, onConfirm, onCancel, loading }: {
  preview: PreviewAssignResult; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <Card className="mb-4 border-yellow-300 bg-yellow-50">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <h3 className="text-sm font-semibold text-yellow-800">Overwork warning</h3>
        </div>
        <p className="mb-4 text-xs text-yellow-700">Reassigning this task would flag an overwork concern for the new assignee.</p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['before', 'after'] as const).map((phase) => (
            <div key={phase}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{phase}</p>
              <div className="space-y-1.5">
                <SignalRow label="Load"       tripped={preview[phase].loadVsBaseline.tripped}  reason={preview[phase].loadVsBaseline.reason} />
                <SignalRow label="Concurrent" tripped={preview[phase].concurrent.tripped}       reason={preview[phase].concurrent.reason} />
                <SignalRow label="Stale"      tripped={preview[phase].staleInProgress.tripped}  reason={preview[phase].staleInProgress.reason} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} loading={loading}>Confirm anyway</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface EditForm      { title: string; description: string; acceptanceCriteria: string; severity: string; points: number | ''; dueDate: string; actualEndDate: string; assigneeId: string; type: string; sprintId: string; epicId: string; requiresQa: boolean; discipline: string; requiresFrontendHandoff: boolean; priority: string; externalReference: string; requiresPrApproval: boolean; dueDateChangeReason: string; pointsChangeReason: string; }
interface BlockerForm  { reason: string; }
interface FeedbackForm { text: string; }
interface LoanForm     { targetEngineerId: string; reason: string; }
interface HandOffForm  { frontendAssigneeId: string; }
interface HandOffBackForm { backendAssigneeId: string; }
interface SendToQaForm { qaEngineerId: string; }
interface AssignForm   { assigneeId: string; }
interface RejectQaForm { reason: string; targetStage: 'frontend' | 'backend' | ''; }
interface RespondToQaRejectionForm { response: string; }
interface PauseForm    { note: string; }
interface GroomForm    { points: number | ''; priority: string; }
interface AssigneeEditForm { description: string; dueDate: string; dueDateChangeReason: string; }

function DueDateReasonField({ id, registration, error }: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Reason for changing the due date <span className="text-destructive">*</span></Label>
      <Textarea id={id} rows={2} maxLength={500} placeholder="e.g. Waiting on API access from the vendor" {...registration} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PointsReasonField({ id, registration, error }: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Reason for changing the points <span className="text-destructive">*</span></Label>
      <Textarea id={id} rows={2} maxLength={500} placeholder="e.g. The spike showed the work is bigger than we thought" {...registration} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const DEFAULT_SCALE = [1, 2, 3, 5, 8, 13, 21];

function PointScaleGuide({ scale }: { scale: PointScaleEntryDto[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 rounded-md transition-colors"
      >
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>What do story points mean?</span>
        <span className="ml-auto text-blue-400">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="border-t border-blue-200 dark:border-blue-900 px-3 pb-3 pt-2.5 space-y-3">
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            Story points measure <strong>effort and complexity</strong>, not hours. Wider gaps at
            higher values force the team to make deliberate trade-offs — you can't fudge the
            difference between an 8 and a 13.
          </p>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-blue-600 dark:text-blue-400">
                <th className="pb-1.5 pr-3 font-semibold w-8">Pts</th>
                <th className="pb-1.5 pr-3 font-semibold">Label</th>
                <th className="pb-1.5 font-semibold">Time guide</th>
              </tr>
            </thead>
            <tbody>
              {scale.map((e) => (
                <tr key={e.value} className="border-t border-blue-100 dark:border-blue-900/60">
                  <td className="py-1 pr-3 font-bold text-blue-700 dark:text-blue-300">{e.value}</td>
                  <td className="py-1 pr-3 text-foreground">{e.label}</td>
                  <td className="py-1 text-muted-foreground">{e.timeGuide}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <strong>Converting to days:</strong> Divide the task's points by your team's daily output
            rate. Each engineer's velocity baseline (points per cycle) is set in their profile under{' '}
            <strong>Thresholds</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function PlanningPokerPanel({ taskId, canLead, currentUserId, hasDueDate, isAssignee }: {
  taskId: string; canLead: boolean; currentUserId: string; hasDueDate: boolean; isAssignee: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [acceptPoints, setAcceptPoints] = useState<number | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: meta }       = useMeta();
  const { data: estimation } = useEstimation(taskId);
  const submitVote      = useSubmitVote(taskId);
  const revealCards     = useRevealCards(taskId);
  const submitForApproval = useSubmitEstimateForApproval(taskId);
  const approveEst      = useApproveEstimate(taskId);
  const rejectEst       = useRejectEstimate(taskId);
  const resetEst        = useResetEstimation(taskId);

  const isPending = estimation?.pendingApprovalPoints != null;

  const scale = meta?.pointScale?.map((e) => e.value) ?? DEFAULT_SCALE;

  const myVote = estimation?.votes.find((v) => v.voterId === currentUserId);
  const hasVotes = (estimation?.votes.length ?? 0) > 0;

  const median = (() => {
    if (!estimation?.isRevealed || !hasVotes) return null;
    const pts = estimation.votes.map((v) => v.points as number).sort((a, b) => a - b);
    const mid = Math.floor(pts.length / 2);
    return pts.length % 2 === 0 ? Math.round((pts[mid - 1] + pts[mid]) / 2) : pts[mid];
  })();

  const suggestedAccept = acceptPoints ?? (
    median !== null
      ? scale.reduce((prev, curr) => Math.abs(curr - median) < Math.abs(prev - median) ? curr : prev)
      : null
  );

  return (
    <Card className="mt-4 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-muted-foreground" />
          Planning Poker
          {hasVotes && !estimation?.isRevealed && !isPending && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {estimation!.votes.length} vote{estimation!.votes.length !== 1 ? 's' : ''}
            </span>
          )}
          {estimation?.isRevealed && !isPending && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Revealed</span>
          )}
          {isPending && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Pending approval</span>
          )}
        </span>
        <span className="text-muted-foreground text-xs">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          {isPending && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-amber-800 dark:text-amber-400">
                <strong>{estimation!.pendingApprovalPoints} pts</strong> submitted by{' '}
                <strong>{estimation!.submittedByName ?? 'the assignee'}</strong>, awaiting approval from{' '}
                <strong>{estimation!.pendingApproverNames?.join(', ') || 'a department head'}</strong>.
              </p>
              {estimation!.isEscalated && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                  No response from the team lead within the grace period — the department head has been looped in too.
                </p>
              )}
            </div>
          )}

          {/* Fibonacci card buttons */}
          {!estimation?.isRevealed && !isPending && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your vote {myVote ? `— currently ${myVote.points}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {scale.map((pts) => (
                  <button
                    key={pts}
                    onClick={() => submitVote.mutate(pts, {
                      onSuccess: () => toast.success(`Vote: ${pts} pts`),
                    })}
                    disabled={submitVote.isPending}
                    className={cn(
                      'h-10 w-12 rounded-lg border text-sm font-semibold transition-colors',
                      myVote?.points === pts
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:border-primary hover:bg-primary/10',
                    )}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vote list (after reveal) — stays visible while pending too, so the approver can see
              the underlying votes behind the submitted number. */}
          {estimation?.isRevealed && hasVotes && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Votes</p>
              <div className="space-y-1.5">
                {estimation.votes.map((v) => (
                  <div key={v.voterId} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="text-foreground">{v.voterName}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {v.points} pts
                    </span>
                  </div>
                ))}
              </div>
              {median !== null && (
                <p className="mt-2 text-xs text-muted-foreground">Median: <strong>{median}</strong> → nearest Fibonacci: <strong>{suggestedAccept}</strong></p>
              )}
            </div>
          )}

          {/* Hidden vote count before reveal */}
          {!estimation?.isRevealed && hasVotes && (
            <p className="text-xs text-muted-foreground">
              {estimation!.votes.length} team member{estimation!.votes.length !== 1 ? 's have' : ' has'} voted. Cards are hidden until revealed.
            </p>
          )}

          <PointScaleGuide scale={meta?.pointScale ?? []} />

          {/* Approve/reject — the assignee's own Team Lead first, escalating to also include the
              department head after a grace period (or a Team Lead+ fallback when neither
              resolves) — see EstimationApproval on the backend. */}
          {isPending && estimation!.canApprove && (
            <div className="flex flex-wrap items-start gap-2 pt-1 border-t border-border">
              <Button size="sm" onClick={() => approveEst.mutate(undefined, {
                onSuccess: () => toast.success(`Approved: ${estimation!.pendingApprovalPoints} pts written to task.`),
                onError: (e) => toast.error((e as Error).message ?? 'Failed to approve.'),
              })} loading={approveEst.isPending}>
                Approve
              </Button>
              {!showReject ? (
                <Button size="sm" variant="ghost" onClick={() => setShowReject(true)}>Reject</Button>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    placeholder="Reason (optional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="h-8 max-w-xs text-xs"
                  />
                  <Button
                    size="sm" variant="danger"
                    onClick={() => rejectEst.mutate(rejectReason || undefined, {
                      onSuccess: () => { toast.success('Estimate rejected.'); setShowReject(false); setRejectReason(''); },
                      onError: (e) => toast.error((e as Error).message ?? 'Failed to reject.'),
                    })}
                    loading={rejectEst.isPending}
                  >
                    Confirm reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                </div>
              )}
            </div>
          )}

          {/* Reveal/reset — Team Lead+ only, and only while nothing is pending approval. */}
          {canLead && !isPending && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
              {!estimation?.isRevealed && hasVotes && (
                <Button size="sm" variant="secondary" onClick={() => revealCards.mutate(undefined, {
                  onSuccess: () => toast.success('Cards revealed.'),
                })} loading={revealCards.isPending}>
                  Reveal cards
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => resetEst.mutate(undefined, {
                onSuccess: () => { toast.success('Estimation reset.'); setAcceptPoints(null); },
              })} loading={resetEst.isPending}>
                Reset
              </Button>
            </div>
          )}

          {/* Submit for approval — the task's own assignee, or a Team Lead+ on their behalf. */}
          {(canLead || isAssignee) && !isPending && estimation?.isRevealed && (
            <div className={cn('flex flex-wrap items-center gap-2', !canLead && 'pt-1 border-t border-border')}>
              <div className="flex items-center gap-2">
                <select
                  value={acceptPoints ?? suggestedAccept ?? ''}
                  onChange={(e) => setAcceptPoints(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {scale.map((p) => <option key={p} value={p}>{p} pts</option>)}
                </select>
                <Button
                  size="sm"
                  disabled={!hasDueDate}
                  title={hasDueDate ? undefined : 'Set a due date first — real points need a date to schedule against.'}
                  onClick={() => {
                    const pts = acceptPoints ?? suggestedAccept!;
                    submitForApproval.mutate(pts, {
                      onSuccess: () => { toast.success(`Request sent — ${pts} pts awaiting approval.`); setAcceptPoints(null); },
                      onError: (e) => toast.error((e as Error).message ?? 'Failed to submit.'),
                    });
                  }}
                  loading={submitForApproval.isPending}
                >
                  Submit for approval
                </Button>
              </div>
              {!hasDueDate && (
                <p className="text-xs text-muted-foreground">Set a due date first — real points need a date to schedule against.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PrApprovalPanel({ taskId, task, canAct }: { taskId: string; task: TaskDto; canAct: boolean }) {
  const [open, setOpen] = useState(false);
  const [prLink, setPrLink] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  const { data: approverCandidates } = usePrApprovalCandidates(showReassign);
  const requestApproval = useRequestPrApproval(taskId);
  const approve  = useApprovePrApproval(taskId);
  const reject   = useRejectPrApproval(taskId);
  const reassign = useReassignPrApprover(taskId);

  const isPending  = !!task.pendingPrApprovalRequestedAt;
  const isApproved = !!task.prApprovedAt && !isPending;
  const approverLabel = task.pendingPrApprovalDelegatedToName
    ?? task.pendingPrApprovalApproverNames?.join(', ')
    ?? 'a department head';

  return (
    <Card className="mt-4 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
          PR Approval
          {isPending && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Pending approval</span>
          )}
          {isApproved && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Approved</span>
          )}
        </span>
        <span className="text-muted-foreground text-xs">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          {isPending && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-amber-800 dark:text-amber-400">
                {task.prLink && (
                  <a href={task.prLink} target="_blank" rel="noreferrer" className="font-semibold underline break-all">{task.prLink}</a>
                )}{' '}
                submitted by <strong>{task.pendingPrApprovalRequestedByName ?? 'the assignee'}</strong>, awaiting
                approval from <strong>{approverLabel}</strong>.
              </p>
            </div>
          )}

          {isApproved && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-emerald-800 dark:text-emerald-400">
                PR approved{task.prLink && (
                  <> — <a href={task.prLink} target="_blank" rel="noreferrer" className="underline break-all">{task.prLink}</a></>
                )}.
              </p>
            </div>
          )}

          {!isPending && !isApproved && canAct && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="PR link (e.g. Bitbucket URL)"
                value={prLink}
                onChange={(e) => setPrLink(e.target.value)}
                className="h-8 min-w-[220px] flex-1 text-xs"
              />
              <Button
                size="sm"
                disabled={!prLink.trim()}
                onClick={() => requestApproval.mutate(prLink.trim(), {
                  onSuccess: () => { toast.success('PR submitted for approval.'); setPrLink(''); },
                  onError: (e) => toast.error((e as Error).message ?? 'Failed to submit.'),
                })}
                loading={requestApproval.isPending}
              >
                Submit for approval
              </Button>
            </div>
          )}

          {isPending && task.canApprovePrApproval && (
            <div className="flex flex-wrap items-start gap-2 pt-1 border-t border-border">
              <Button size="sm" onClick={() => approve.mutate(undefined, {
                onSuccess: () => toast.success('PR approved.'),
                onError: (e) => toast.error((e as Error).message ?? 'Failed to approve.'),
              })} loading={approve.isPending}>
                Approve
              </Button>

              {!showReject ? (
                <Button size="sm" variant="ghost" onClick={() => setShowReject(true)}>Reject</Button>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    placeholder="Reason (optional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="h-8 max-w-xs text-xs"
                  />
                  <Button
                    size="sm" variant="danger"
                    onClick={() => reject.mutate(rejectReason || undefined, {
                      onSuccess: () => { toast.success('PR rejected.'); setShowReject(false); setRejectReason(''); },
                      onError: (e) => toast.error((e as Error).message ?? 'Failed to reject.'),
                    })}
                    loading={reject.isPending}
                  >
                    Confirm reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                </div>
              )}

              {!showReassign ? (
                <Button size="sm" variant="ghost" onClick={() => setShowReassign(true)}>Reassign approver</Button>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <select
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select an approver…</option>
                    {approverCandidates?.filter((e) => e.isActive).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!reassignTo}
                    onClick={() => reassign.mutate(reassignTo, {
                      onSuccess: () => { toast.success('Approval reassigned.'); setShowReassign(false); setReassignTo(''); },
                      onError: (e) => toast.error((e as Error).message ?? 'Failed to reassign.'),
                    })}
                    loading={reassign.isPending}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowReassign(false); setReassignTo(''); }}>Cancel</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SubtasksCard({
  taskId, task, canManage, canLoan, loanCandidates, onMarkDone, onSendToQa, markDonePending, sendToQaPending,
}: {
  taskId: string;
  task: TaskDto;
  canManage: boolean;
  canLoan: boolean;
  loanCandidates: EngineerDto[] | undefined;
  onMarkDone: () => void;
  onSendToQa: () => void;
  markDonePending: boolean;
  sendToQaPending: boolean;
}) {
  const { data: subtasks = [], isLoading } = useSubtasks(taskId);
  const addSubtask    = useAddSubtask(taskId);
  const toggleSubtask = useToggleSubtask(taskId);
  const deleteSubtask = useDeleteSubtask(taskId);
  const loanSubtask   = useLoanSubtask(taskId);
  const recallSubtask = useRecallSubtask(taskId);
  const [title, setTitle] = useState('');
  const [loaningSubtaskId, setLoaningSubtaskId] = useState<string | null>(null);
  const loanForm = useForm<{ targetEngineerId: string; reason: string }>();

  if (!isLoading && subtasks.length === 0 && !canManage) return null;

  const doneCount = subtasks.filter((s) => s.isDone).length;
  const total     = subtasks.length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone   = total > 0 && doneCount === total;
  const canTransition = task.status === 'active' && !task.parentTaskId;
  const showPrompt = allDone && canManage && canTransition;

  const handleAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    addSubtask.mutate(trimmed, {
      onSuccess: () => setTitle(''),
      onError:   (e) => toast.error((e as Error).message ?? 'Failed to add subtask.'),
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Subtasks</CardTitle>
          {total > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{doneCount}/{total}</span>
          )}
        </div>
        {total > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {showPrompt && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="text-xs font-medium text-foreground">
              All subtasks complete — {task.requiresQa ? 'ready to send to QA?' : 'mark this task done?'}
            </p>
            <Button
              size="sm"
              onClick={task.requiresQa ? onSendToQa : onMarkDone}
              loading={task.requiresQa ? sendToQaPending : markDonePending}
            >
              {task.requiresQa ? 'Send to QA' : 'Mark done'}
            </Button>
          </div>
        )}

        {task.status === 'done' && total > 0 && !allDone && (
          <p className="mb-3 text-xs text-muted-foreground">
            {total - doneCount} subtask{total - doneCount !== 1 ? 's' : ''} reopened since this task was marked done.
          </p>
        )}

        {subtasks.length > 0 && (
          <ul className="space-y-0.5">
            {subtasks.map((s) => (
              <li key={s.id}>
                <div className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={s.isDone}
                    disabled={!canManage || toggleSubtask.isPending}
                    onChange={(e) => toggleSubtask.mutate({ subtaskId: s.id, isDone: e.target.checked })}
                    className="h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <span className={cn('flex-1 text-sm', s.isDone && 'text-muted-foreground line-through')}>
                    {s.title}
                  </span>
                  {s.assigneeName && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Loaned to">
                      {s.assigneeName}
                    </span>
                  )}
                  {canLoan && s.assigneeId && (
                    <button
                      type="button"
                      onClick={() => recallSubtask.mutate(s.id, {
                        onSuccess: () => toast.success('Subtask recalled.'),
                        onError:   (e) => toast.error((e as Error).message ?? 'Failed to recall subtask.'),
                      })}
                      disabled={recallSubtask.isPending}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Recall ${s.title}`}
                      title="Recall to unassigned"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canLoan && !s.isDone && (
                    <button
                      type="button"
                      onClick={() => { setLoaningSubtaskId(loaningSubtaskId === s.id ? null : s.id); loanForm.reset(); }}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      aria-label={`Loan ${s.title}`}
                      title="Loan to another department"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => deleteSubtask.mutate(s.id)}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label={`Delete ${s.title}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {loaningSubtaskId === s.id && (
                  <form
                    className="ml-6 mb-1.5 flex items-center gap-1.5 rounded-md border border-border bg-muted/30 p-2"
                    onSubmit={loanForm.handleSubmit((values) =>
                      loanSubtask.mutate({ subtaskId: s.id, targetEngineerId: values.targetEngineerId, reason: values.reason || undefined }, {
                        onSuccess: () => { toast.success('Subtask loaned successfully.'); setLoaningSubtaskId(null); loanForm.reset(); },
                        onError:   (e) => toast.error((e as Error).message ?? 'Failed to loan subtask.'),
                      })
                    )}
                  >
                    <Controller
                      name="targetEngineerId"
                      control={loanForm.control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="Target engineer…"
                          emptyLabel="No matching engineers"
                          options={loanCandidates?.filter((e) => e.id !== task.assigneeId && e.isActive).map((e) => ({ value: e.id, label: e.name })) ?? []}
                        />
                      )}
                    />
                    <Input {...loanForm.register('reason')} placeholder="Reason (optional)" className="h-8 text-xs" />
                    <Button size="sm" type="submit" loading={loanSubtask.isPending} disabled={!loanForm.watch('targetEngineerId')}>Loan</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setLoaningSubtaskId(null)}>Cancel</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className={cn('flex items-center gap-2', subtasks.length > 0 && 'mt-2')}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="Add a subtask…"
              className="h-8 text-sm"
            />
            <Button size="sm" variant="secondary" onClick={handleAdd} loading={addSubtask.isPending} disabled={!title.trim()}>
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, allow } = useAuth();
  const canLoan = allow('team-lead-or-head-only') || allow('pmo-only'); // task loan is [TeamLeadOrHeadOnly, PmoOnly]

  const { data: task, isLoading, error, refetch } = useTask(id!);
  // Also doubles as the discipline check for QA-assignment restrictions below — an unassigned
  // QA sub-task (no QA-flagged engineer was available to auto-assign it) would otherwise be
  // stuck forever, so the original task is looked up so its assignee can accept it themselves.
  const { data: originalTask } = useTask(task?.parentTaskId ?? '');
  const { data: engineers }    = useEngineerList();
  // @mention candidates: engineers is scoped to the caller's own team (or department, or org,
  // depending on role) via ListEngineersQuery — the wrong boundary for "who can I mention here".
  // Project *membership* (the /members list) is narrower too — a PM+/global-role creator, a task
  // assignee, a teammate on the owning team who was never formally added as a member, or this
  // specific task's own creator (who may have no other standing project access at all, e.g. a
  // PMO engineer filing a task for a team they aren't part of) all have real reason to be
  // mentionable but wouldn't show up there. Task-scoped (not project-scoped) specifically so the
  // creator can be included, and unlike projectAssignableEngineers below, it has no PM+ gate, so
  // every commenter — not just PMs — gets the full, correct list.
  const { data: mentionCandidates } = useTaskMentionCandidates(id!);
  // QA task assignment needs org-wide visibility, not the caller's department-scoped roster —
  // a department head editing a QA task routinely needs a reviewer from a different department
  // (e.g. Head of Engineering assigning a Product-discipline QA engineer). See qaCandidates usage
  // in assignableEngineers below.
  const { data: qaCandidates } = useQaCandidates(!!task?.parentTaskId && allow('pm-or-above'));
  // A normal task's Assignee picker needs the task's own project team, not the caller's
  // department-scoped roster — see assignableEngineers below.
  const { data: projectAssignableEngineers } = useProjectAssignableEngineers(
    task?.projectId ?? '', !!task && !task.parentTaskId && allow('pm-or-above'));
  // Hand-off pickers: fetched from a task-scoped endpoint the assignee can call, NOT from the
  // PMO-only project-assignable roster above — otherwise a backend engineer (the one who actually
  // performs the hand-off) saw an empty list.
  // Only fetched for people who can actually perform the hand-off (the assignee or PMO and above),
  // so read-only viewers don't trigger a 403.
  const canSeeHandoff = !!task && (task.assigneeId === currentUser?.id || allow('pm-or-above'));
  const { data: frontendHandoffCandidates } = useHandoffCandidates(
    id!, 'frontend', canSeeHandoff && !!task?.requiresFrontendHandoff && task?.currentStage === 'backend');
  const { data: backendHandoffCandidates } = useHandoffCandidates(
    id!, 'backend', canSeeHandoff && !!task?.requiresFrontendHandoff && task?.currentStage === 'frontend');
  const { data: teams }        = useTeamList();
  // The engineer list is gated above a plain engineer's role, so it comes back empty for most
  // viewers — fetch the assignee directly too. GetEngineer already allows self-access, so an
  // assignee viewing their own task still resolves a name/baseline here even when the list can't.
  const { data: assigneeEngineer } = useEngineer(task?.assigneeId ?? '');
  const { data: loanCandidates } = useLoanCandidates(canLoan);
  const { data: projects }     = useProjectList();
  // Heads only — GET /thresholds is any-head, so every other role would just get a 403.
  const { data: thresholds }   = useThresholds(allow('any-head'));
  const { data: sprints }      = useSprintList();
  const { data: links }        = useTaskDependencies(id!);
  const { data: epics }        = useEpicsByProject(task?.projectId ?? '');
  const { data: allTasks }     = useTaskList({ projectId: task?.projectId, limit: 200 });
  const { data: meta }         = useMeta();
  const updateTask     = useUpdateTask(id!);
  const deleteTask     = useDeleteTask();
  const flagBlocker    = useFlagBlocker(id!);
  const clearBlocker   = useClearBlocker(id!);
  const pauseTask      = usePauseTask(id!);
  const resumeTask     = useResumeTask(id!);
  const returnToBacklog = useReturnTaskToBacklog(id!);
  const previewAssign  = usePreviewAssign(id!);
  const submitFeedback = useSubmitFeedback();
  const assignTask     = useAssignTask(id!);
  const loanTask       = useLoanTask(id!);
  const recallTask     = useRecallTask(id!);
  const addDep         = useAddDependency(id!);
  const removeDep      = useRemoveDependency(id!);
  const sendToQa       = useSendToQa(id!);
  const handOffToFrontend = useHandOffToFrontend(id!);
  const handOffToBackend = useHandOffToBackend(id!);
  const proposeQaRejection  = useProposeQaRejection(id!);
  const confirmQaRejection  = useConfirmQaRejection(id!);
  const withdrawQaRejection = useWithdrawQaRejection(id!);
  const respondToQaRejection = useRespondToQaRejection(id!);
  const markTaskDone   = useMarkTaskDone(id!);
  const groomOwnTask   = useGroomOwnTask(id!);
  const assigneeEditTask = useAssigneeEditTask(id!);
  const { data: timeSummary } = useTaskTimeSummary(id);

  const [showEdit,      setShowEdit]      = useState(false);
  const [showBlocker,   setShowBlocker]   = useState(false);
  const [showPause,     setShowPause]     = useState(false);
  const [showGroom,     setShowGroom]     = useState(false);
  const [showAssigneeEdit, setShowAssigneeEdit] = useState(false);
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [showAssign,    setShowAssign]    = useState(false);
  const [showLoan,      setShowLoan]      = useState(false);
  const [showRejectQa,  setShowRejectQa]  = useState(false);
  const [showRespondToRejection, setShowRespondToRejection] = useState(false);
  const [showHandOff,   setShowHandOff]   = useState(false);
  const [showHandOffBack, setShowHandOffBack] = useState(false);
  const [showSendToQa,  setShowSendToQa]  = useState(false);
  const [pendingEdit,   setPendingEdit]   = useState<EditForm | null>(null);
  const [preview,       setPreview]       = useState<PreviewAssignResult | null>(null);
  const [depTaskId,     setDepTaskId]     = useState('');
  const [showAllQaEngineers, setShowAllQaEngineers] = useState(false);

  const editForm      = useForm<EditForm>();
  const blockerForm   = useForm<BlockerForm>();
  const pauseForm     = useForm<PauseForm>();
  const groomForm     = useForm<GroomForm>();
  const assigneeEditForm = useForm<AssigneeEditForm>();
  const feedbackForm  = useForm<FeedbackForm>();
  const assignForm    = useForm<AssignForm>();
  const loanForm      = useForm<LoanForm>();
  const rejectQaForm  = useForm<RejectQaForm>();
  const respondForm   = useForm<RespondToQaRejectionForm>();
  const handOffForm   = useForm<HandOffForm>();
  const handOffBackForm = useForm<HandOffBackForm>();
  const sendToQaForm  = useForm<SendToQaForm>();
  // Fetched only while the "Send to QA" picker is open — it's shown once per send, not on every
  // page load, and this endpoint is open to the task's own assignee (not just PM-or-above).
  const { data: qaSendCandidates } = useQaSendCandidates(id!, showSendToQa);
  const { confirm, dialog } = useConfirm();

  if (isLoading)        return <DetailPageSkeleton />;
  if (error || !task)   return <ErrorState error={error} onRetry={refetch} />;

  const isOwner = task.assigneeId === currentUser!.id;
  const canEdit = allow('team-lead-or-above');
  // Self-service gap: below Team Lead, an engineer can create a task for themselves (always
  // auto-assigned, since they can't assign to anyone else) but the general edit form is
  // Team-Lead-gated — without this, a self-filed task sits ungroomed in Backlog forever until
  // someone else notices and points it. Narrow on purpose: only the task's own creator, only
  // while it's still in Backlog, only points/priority (via the dedicated /groom endpoint).
  const canGroomOwnTask = !canEdit && task.status === 'backlog' && task.createdById === currentUser!.id && isOwner;
  // Self-service gap #2: an assignee has no way to fix their own task's description or push its
  // due date out without asking a Team Lead+ to do it for them. Points deliberately stay out of
  // reach here — those still go through Planning Poker + department-head approval (see
  // PlanningPokerPanel) — this is only Description/DueDate, matching UpdateDetails' own
  // Done/InQa guard so the button doesn't appear for a task that would reject the edit anyway.
  const canAssigneeEdit = !canEdit && isOwner && task.status !== 'done' && task.status !== 'inQa';
  // Delete stays PM+ (unchanged backend gate) even though Edit widened to Team Lead — kept
  // separate so a Team Lead doesn't see a Delete button the backend would 403 on.
  const canDelete = allow('pm-or-above');
  const canAcceptUnassignedQa = !task.assigneeId && !!task.parentTaskId && originalTask?.assigneeId === currentUser!.id;
  const canAct  = isOwner || canEdit || canAcceptUnassignedQa;
  const canManageSubtasks = isOwner || allow('team-lead-or-above');
  // A Team Lead may claim an unassigned task for their own team via the dedicated /assign
  // endpoint (AssignTaskCommand) — deliberately not folded into canEdit/canAct, which would
  // also unlock the full Edit form's title/points/due-date fields on tasks outside their team.
  const canClaimForTeam = currentUser!.role === 'team_lead' && !task.parentTaskId && !task.assigneeId;
  // Anyone with access to this task (the page having loaded it at all already proves that) can
  // claim an unassigned, non-QA-subtask for themselves via the same /assign endpoint — it now
  // allows self-assignment with no capability gate, matching SendToQa/FlagBlocker. Lets a
  // developer pick up their own sprint-committed work without waiting on a Team Lead.
  const canClaimForSelf = !task.parentTaskId && !task.assigneeId;

  // Mirrors QaAssignmentPolicy on the backend: a QA sub-task whose parent has no discipline
  // set can only be assigned by a Head of Product/PMO/Functional, and only to a QA engineer
  // whose team sits in the Product or Functional department.
  const parentHasNoDiscipline = !!task.parentTaskId && !!originalTask && !originalTask.discipline;
  const isAllowedQaAssigner = ['head_of_product', 'head_of_pmo', 'head_of_functional'].includes(currentUser!.role);
  const departmentOf = (teamId: string | null) => (teamId ? teams?.find((t) => t.id === teamId)?.department ?? null : null);
  // Driven by the Discipline field live, in this same form — not the original task's stored
  // discipline — so picking a discipline immediately narrows the Assignee options right below it,
  // rather than the two fields looking related but silently doing nothing to each other. Defaults
  // to the original task's discipline via editForm.reset above, but is overridable here.
  const qaDiscipline = task.parentTaskId ? (editForm.watch('discipline') || null) : null;
  // QA branches source from qaCandidates (org-wide, unscoped by department) rather than the
  // caller's department-scoped engineers list — otherwise a department head could never see a
  // QA reviewer outside their own department, no matter what discipline matched.
  const qaEngineersForDiscipline = qaDiscipline
    ? qaCandidates?.filter((e) => e.isActive && e.isQa && e.discipline === qaDiscipline)
    : undefined;
  const disciplineFilterActive = !!qaDiscipline && !showAllQaEngineers && !!qaEngineersForDiscipline?.length;
  const assignableEngineers = (task.parentTaskId ? qaCandidates : projectAssignableEngineers)?.filter((e) => {
    if (!e.isActive) return false;
    if (!task.parentTaskId) return true;
    if (!e.isQa) return false;
    if (parentHasNoDiscipline) {
      // The department restriction is a hard backend rule (QaAssignmentPolicy) — a discipline
      // pick here narrows further within it, but never replaces it.
      const dept = departmentOf(e.teamId);
      if (dept !== 'Product' && dept !== 'Functional') return false;
      return !qaDiscipline || e.discipline === qaDiscipline;
    }
    if (disciplineFilterActive) return e.discipline === qaDiscipline;
    return true;
  });
  const canHandOffToFrontend = task.requiresFrontendHandoff && task.currentStage === 'backend';
  // Reverse of the above — lets a mistaken hand-off (wrong frontend engineer picked) be corrected,
  // or sends the task back for more backend work, without touching the task's own Status.
  const canHandOffToBackend = task.requiresFrontendHandoff && task.currentStage === 'frontend';

  const proj = projects?.find((p) => p.id === task.projectId);
  const eng  = engineers?.find((e) => e.id === task.assigneeId) ?? assigneeEngineer;

  // A reason is required only when an EXISTING due date is being moved — setting the first date
  // on an unscheduled task needs none.
  const currentDueDate = task.dueDate?.slice(0, 10) ?? '';
  const editDueDate = editForm.watch('dueDate');
  const assigneeEditDueDate = assigneeEditForm.watch('dueDate');
  const dueDateMovesInEdit = !!currentDueDate && !!editDueDate && editDueDate !== currentDueDate;
  // Likewise for points: only changing an existing estimate on a task that has been started needs a reason.
  const pointsChangeNeedsReasonInEdit = pointsChangeNeedsReason(task, editForm.watch('points'));
  const dueDateMovesInAssigneeEdit = !!currentDueDate && !!assigneeEditDueDate && assigneeEditDueDate !== currentDueDate;

  const doUpdate = (values: EditForm) => {
    const removeFromSprint = !values.sprintId && !!task.sprintId;
    const removeFromEpic = !values.epicId && !!task.epicId;
    const removePriority = !values.priority && !!task.priority;
    const removeExternalReference = !values.externalReference && !!task.externalReference;
    // Only send dueDate when it actually changed, so an unrelated edit doesn't record a
    // no-op due-date history entry.
    const dueDateChanged = (values.dueDate || '') !== (task.dueDate?.slice(0, 10) ?? '');
    // Same reasoning for points — an ungroomed (0-point) task must stay editable for anything
    // else (assignee, description, ...) without the request round-tripping its own unchanged 0
    // into the 1–13 "valid points" validator and 400ing on every save.
    const pointsChanged = values.points !== '' && Number(values.points) !== task.points;
    updateTask.mutate(
      { ...values, acceptanceCriteria: values.acceptanceCriteria || undefined, severity: values.severity || undefined, epicId: values.epicId || undefined, removeFromEpic: removeFromEpic || undefined, points: pointsChanged ? Number(values.points) : undefined, dueDate: dueDateChanged ? (values.dueDate || undefined) : undefined, dueDateChangeReason: dueDateChanged && task.dueDate ? values.dueDateChangeReason?.trim() || undefined : undefined, pointsChangeReason: pointsChanged && pointsChangeNeedsReason(task, values.points) ? values.pointsChangeReason?.trim() || undefined : undefined, actualEndDate: values.actualEndDate || undefined, assigneeId: values.assigneeId || undefined, type: values.type || undefined, sprintId: values.sprintId || undefined, removeFromSprint: removeFromSprint || undefined, requiresQa: values.requiresQa, discipline: values.discipline || undefined, priority: values.priority ? Number(values.priority) : undefined, removePriority: removePriority || undefined, externalReference: values.externalReference || undefined, removeExternalReference: removeExternalReference || undefined },
      {
        onSuccess: () => { toast.success('Task updated.'); setShowEdit(false); setPendingEdit(null); setPreview(null); },
        onError:   (e) => applyServerErrors(e, editForm.setError),
      },
    );
  };

  const handleEdit = editForm.handleSubmit((values) => {
    if (dueDateMovesInEdit && !values.dueDateChangeReason?.trim()) {
      editForm.setError('dueDateChangeReason', { message: 'A reason is required when changing the due date.' });
      return;
    }
    if (pointsChangeNeedsReason(task, values.points) && !values.pointsChangeReason?.trim()) {
      editForm.setError('pointsChangeReason', { message: 'A reason is required when changing the points on a task that has been started.' });
      return;
    }
    const assigneeChanged = values.assigneeId && values.assigneeId !== (task.assigneeId ?? '');
    if (assigneeChanged) {
      previewAssign.mutate(values.assigneeId, {
        onSuccess: (result) => result.wouldFlagOverwork ? (setPendingEdit(values), setPreview(result)) : doUpdate(values),
        onError:   () => doUpdate(values),
      });
    } else {
      doUpdate(values);
    }
  });

  const handleMarkDone = () =>
    markTaskDone.mutate(undefined, {
      onSuccess: () => toast.success('Status updated.'),
      onError:   (e) => toast.error(e instanceof Error ? e.message : 'Failed to update status.'),
    });

  const handleAssigneeEdit = assigneeEditForm.handleSubmit((values) => {
    const dueDateChanged = (values.dueDate || '') !== (task.dueDate?.slice(0, 10) ?? '');
    if (dueDateMovesInAssigneeEdit && !values.dueDateChangeReason?.trim()) {
      assigneeEditForm.setError('dueDateChangeReason', { message: 'A reason is required when changing the due date.' });
      return;
    }
    assigneeEditTask.mutate(
      {
        description: values.description || undefined,
        dueDate: dueDateChanged ? (values.dueDate || undefined) : undefined,
        dueDateChangeReason: dueDateChanged && task.dueDate ? values.dueDateChangeReason?.trim() || undefined : undefined,
      },
      {
        onSuccess: () => { toast.success('Task updated.'); setShowAssigneeEdit(false); },
        onError:   (e) => applyServerErrors(e, assigneeEditForm.setError),
      },
    );
  });

  const handleGroom = groomForm.handleSubmit((values) =>
    groomOwnTask.mutate(
      { points: Number(values.points), priority: values.priority ? Number(values.priority) : undefined },
      {
        onSuccess: () => { toast.success('Task groomed and activated.'); setShowGroom(false); groomForm.reset(); },
        onError:   (e) => applyServerErrors(e, groomForm.setError),
      },
    ),
  );

  const handleDelete = async () => {
    if (!await confirm({ title: 'Delete this task?', description: 'This cannot be undone.', confirmLabel: 'Delete task' })) return;
    deleteTask.mutate(id!, { onSuccess: () => navigate('/tasks') });
  };

  const handleFlagBlocker = blockerForm.handleSubmit((values) =>
    flagBlocker.mutate(values.reason, {
      onSuccess: () => { toast.success('Blocker flagged.'); setShowBlocker(false); blockerForm.reset(); },
    }),
  );

  const handleClearBlocker = () =>
    clearBlocker.mutate(undefined, { onSuccess: () => toast.success('Blocker cleared.') });

  const handlePause = pauseForm.handleSubmit((values) =>
    pauseTask.mutate(values.note || undefined, {
      onSuccess: () => { toast.success('Task paused.'); setShowPause(false); pauseForm.reset(); },
    }),
  );

  const handleResume = () =>
    resumeTask.mutate(undefined, { onSuccess: () => toast.success('Task resumed.') });

  const handleReturnToBacklog = async () => {
    if (!await confirm({
      title: 'Return this task to the backlog?',
      description: 'Unassigns it, clears its due date, and removes it from its sprint if it\'s in one. The assignee will be notified.',
      confirmLabel: 'Return to backlog',
    })) return;
    returnToBacklog.mutate(undefined, {
      onSuccess: () => toast.success('Task returned to the backlog.'),
      onError:   (e) => toast.error(e instanceof Error ? e.message : 'Failed to return task to the backlog.'),
    });
  };

  const handleFeedback = feedbackForm.handleSubmit((values) =>
    submitFeedback.mutate({ text: values.text, taskId: id }, {
      onSuccess: () => { toast.success('Feedback submitted.'); setShowFeedback(false); feedbackForm.reset(); },
    }),
  );

  return (
    <div className="max-w-5xl">
      {dialog}
      <PageHeader
        breadcrumbs={[{ label: 'Tasks', href: '/tasks', smart: true }]}
        title={task.taskKey ? `${task.taskKey} — ${task.title}` : task.title}
        actions={
          canEdit || canDelete ? (
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="secondary" size="sm"
                  onClick={() => {
                    // A QA sub-task is created with no discipline of its own (see SendToQaCommand) —
                    // default the field to the original task's discipline so the Assignee picker
                    // below starts pre-filtered exactly like before, while still letting the actor
                    // override it (e.g. to pick a different discipline of QA reviewer).
                    editForm.reset({ title: task.title, description: task.description ?? '', acceptanceCriteria: task.acceptanceCriteria ?? '', severity: task.severity ?? '', points: task.points, dueDate: task.dueDate?.slice(0, 10) ?? '', actualEndDate: task.actualEndDate?.slice(0, 10) ?? '', assigneeId: task.assigneeId ?? '', type: task.taskType, sprintId: task.sprintId ?? '', epicId: task.epicId ?? '', requiresQa: task.requiresQa, discipline: task.discipline ?? (task.parentTaskId ? originalTask?.discipline ?? '' : ''), requiresFrontendHandoff: task.requiresFrontendHandoff, priority: task.priority?.toString() ?? '', externalReference: task.externalReference ?? '', requiresPrApproval: task.requiresPrApproval, dueDateChangeReason: '', pointsChangeReason: '' });
                    setPendingEdit(null); setPreview(null); setShowEdit((v) => !v);
                  }}
                >
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteTask.isPending}>Delete</Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-4">
      <div className="min-w-0 flex-1">
      {/* Details card */}
      <Card className={cn(
        'mb-4 overflow-hidden border-l-4',
        task.status === 'blocked' ? 'border-l-red-400'      :
        task.status === 'done'    ? 'border-l-emerald-400'  :
        task.status === 'inQa'   ? 'border-l-purple-400'   :
        task.status === 'paused' ? 'border-l-yellow-400'   :
                                    'border-l-primary',
      )}>
        <CardContent className="p-4">
          {/* Meta strip */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge label={STATUS_LABEL[task.status]} variant={STATUS_VARIANT[task.status]} />
            {task.status === 'backlog' && (
              <HelpTooltip
                title="How to get out of Backlog"
                body={backlogExitHint(!!task.assigneeId, task.points)}
              />
            )}
            {task.status === 'inQa' && (
              <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">
                <FlaskConical className="h-3 w-3" /> Awaiting QA review
              </span>
            )}
            {task.requiresQa && task.status !== 'inQa' && task.status !== 'done' && (
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                Requires QA
              </span>
            )}
            {task.requiresFrontendHandoff && task.status !== 'done' && (
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">
                <Shuffle className="h-3 w-3" /> In: {task.currentStage === 'frontend' ? 'Frontend' : 'Backend'}
              </span>
            )}
            {/* A personal to-do has no type, estimate or story points — only the hours logged against it. */}
            {!task.isPersonal && (
              <>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{task.taskType}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {task.points} pts
                  {(() => { const d = formatPtsDays(task.points, eng); return d ? ` · ${d}` : ''; })()}
                </span>
              </>
            )}
            {timeSummary && timeSummary.totalHoursLogged > 0 && (
              <span className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                !task.isPersonal && timeSummary.expectedHours != null && timeSummary.totalHoursLogged > timeSummary.expectedHours * 1.5
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-muted text-muted-foreground',
              )}>
                {timeSummary.totalHoursLogged}h logged
                {!task.isPersonal && timeSummary.expectedHours != null && ` · Est: ≈${timeSummary.expectedHours.toFixed(1)}h`}
              </span>
            )}
            {task.severity && (
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', SEVERITY_COLORS[task.severity])}>
                {task.severity}
              </span>
            )}
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
              <RichTextContent html={task.description} />
            </div>
          )}

          {task.acceptanceCriteria && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Acceptance criteria</p>
              <RichTextContent html={task.acceptanceCriteria} />
            </div>
          )}

          {task.blockerReason && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Blocker</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{task.blockerReason}</p>
            </div>
          )}

          {task.reactivationReason && (
            <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                Returned from QA{task.reactivatedByName && ` by ${task.reactivatedByName}`}
              </p>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">{task.reactivationReason}</p>
            </div>
          )}

          {task.pauseNote && (
            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/40 dark:bg-yellow-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">Paused</p>
              <p className="mt-1 text-sm text-yellow-800 dark:text-yellow-400">{task.pauseNote}</p>
            </div>
          )}

          {task.externalReference && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-muted bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                External reference: <span className="font-semibold text-foreground">{task.externalReference}</span>
              </p>
            </div>
          )}

          {task.qaTaskId && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/40 dark:bg-purple-950/20">
              <FlaskConical className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                QA task: {' '}
                <Link to={`/tasks/${task.qaTaskId}`} className="font-semibold underline hover:opacity-80">
                  View QA task →
                </Link>
              </p>
            </div>
          )}

          {task.parentTaskId && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-muted bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Original task: {' '}
                <Link to={`/tasks/${task.parentTaskId}`} className="font-semibold text-foreground underline hover:opacity-80">
                  View original →
                </Link>
              </p>
            </div>
          )}
        </CardContent>

        {((canAct && task.status !== 'done') || (canLoan && task.assigneeId && task.status !== 'done') || (canClaimForTeam && task.status !== 'done') || (canClaimForSelf && task.status !== 'done')) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            {canClaimForTeam && (
              <Button variant="secondary" size="sm" onClick={() => { setShowAssign((v) => !v); assignForm.reset(); }}>Assign task</Button>
            )}
            {canClaimForSelf && (
              <Button
                variant="secondary" size="sm"
                loading={assignTask.isPending}
                onClick={() => assignTask.mutate({ assigneeId: currentUser!.id }, {
                  onSuccess: () => toast.success('Task claimed.'),
                  onError:   (e) => toast.error((e as Error).message ?? 'Failed to claim task.'),
                })}
              >
                Claim this task
              </Button>
            )}
            {canGroomOwnTask && (
              <Button variant="secondary" size="sm" onClick={() => setShowGroom((v) => !v)}>Groom &amp; activate</Button>
            )}
            {canAssigneeEdit && (
              <Button
                variant="secondary" size="sm"
                onClick={() => {
                  assigneeEditForm.reset({ description: task.description ?? '', dueDate: task.dueDate?.slice(0, 10) ?? '', dueDateChangeReason: '' });
                  setShowAssigneeEdit((v) => !v);
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit description &amp; due date
              </Button>
            )}
            {canAct && task.status === 'active' && !task.parentTaskId && (
              <>
                {canHandOffToFrontend && (
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => { setShowHandOff((v) => !v); handOffForm.reset(); }}
                  >
                    <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                    Hand off to Frontend
                  </Button>
                )}
                {canHandOffToBackend && (
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => { setShowHandOffBack((v) => !v); handOffBackForm.reset(); }}
                  >
                    <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                    Hand off to Backend
                  </Button>
                )}
                {task.requiresQa ? (
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => { setShowSendToQa((v) => !v); sendToQaForm.reset(); }}
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
                )}
                {!task.isPersonal && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setShowBlocker((v) => !v)}>Flag blocker</Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowPause((v) => !v)}>Pause task</Button>
                  </>
                )}
                {canEdit && !task.isPersonal && (
                  <Button variant="secondary" size="sm" onClick={handleReturnToBacklog} loading={returnToBacklog.isPending}>
                    Return to backlog
                  </Button>
                )}
              </>
            )}
            {canAct && task.status === 'blocked' && (
              <Button variant="secondary" size="sm" onClick={handleClearBlocker} loading={clearBlocker.isPending}>Clear blocker</Button>
            )}
            {canAct && task.status === 'paused' && (
              <Button variant="secondary" size="sm" onClick={handleResume} loading={resumeTask.isPending}>Resume task</Button>
            )}
            {task.status === 'inQa' && (
              <p className="text-xs text-muted-foreground italic">Awaiting QA review. Accept via the QA task or wait for feedback.</p>
            )}
            {/* QA task actions — shown when this IS the QA task (has parentTaskId) */}
            {canAct && task.parentTaskId && task.status === 'active' && !task.pendingRejectionReason && (
              <>
                <Button variant="secondary" size="sm" onClick={handleMarkDone} loading={markTaskDone.isPending}>
                  Accept (QA passed)
                </Button>
                <Button
                  variant="danger" size="sm"
                  disabled={!task.canRejectQa}
                  title={task.canRejectQa ? undefined : 'Only the reviewer, their department head, or PMO can reject a QA review'}
                  onClick={() => { setShowRejectQa((v) => !v); rejectQaForm.reset(); }}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Propose rejection
                </Button>
              </>
            )}
            {/* A rejection is pending on the original task — nothing moves until it's confirmed
                or withdrawn, so Accept/Propose don't make sense here. */}
            {canAct && task.parentTaskId && task.status === 'active' && task.pendingRejectionReason && (
              <>
                <Button
                  variant="danger" size="sm"
                  disabled={!task.canRejectQa}
                  loading={confirmQaRejection.isPending}
                  onClick={() => confirmQaRejection.mutate(undefined, {
                    onSuccess: () => toast.success('Rejection confirmed. Original task is back in progress.'),
                    onError:   (e) => toast.error((e as Error).message ?? 'Failed to confirm rejection.'),
                  })}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Confirm rejection
                </Button>
                <Button
                  variant="secondary" size="sm"
                  disabled={!task.canRejectQa}
                  loading={withdrawQaRejection.isPending}
                  onClick={() => withdrawQaRejection.mutate(undefined, {
                    onSuccess: () => toast.success('Rejection withdrawn. Review continues — no iteration counted.'),
                    onError:   (e) => toast.error((e as Error).message ?? 'Failed to withdraw rejection.'),
                  })}
                >
                  Withdraw rejection
                </Button>
              </>
            )}
            {canLoan && task.assigneeId && task.status !== 'inQa' && !task.loanedFromEngineerId && (
              <Button variant="secondary" size="sm" onClick={() => { setShowLoan((v) => !v); loanForm.reset(); }}>Loan task</Button>
            )}
            {(canLoan || isOwner) && task.loanedFromEngineerId && (
              <Button
                variant="secondary" size="sm"
                loading={recallTask.isPending}
                onClick={() => recallTask.mutate(undefined, { onSuccess: () => toast.success('Task recalled.') })}
              >
                Recall task
              </Button>
            )}
          </div>
        )}
      </Card>

      {task.pendingRejectionReason && (
        <Card className="mb-4 border-amber-200">
          <ActionCardHeader
            icon={AlertTriangle}
            title={<>QA rejection pending{task.pendingRejectionActorName ? ` — ${task.pendingRejectionActorName}` : ''}</>}
            tone="amber"
          />
          <CardContent className="space-y-3 pt-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Concern</p>
              <p className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-200">{task.pendingRejectionReason}</p>
            </div>
            {task.pendingRejectionResponse ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Response{task.pendingRejectionRespondedByName ? ` — ${task.pendingRejectionRespondedByName}` : ''}
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground">{task.pendingRejectionResponse}</p>
              </div>
            ) : !task.parentTaskId && (isOwner || canEdit) ? (
              showRespondToRejection ? (
                <form
                  onSubmit={respondForm.handleSubmit((values) =>
                    respondToQaRejection.mutate(values.response, {
                      onSuccess: () => {
                        toast.success('Response sent to QA.');
                        setShowRespondToRejection(false);
                        respondForm.reset();
                      },
                      onError: (e) => toast.error((e as Error).message ?? 'Failed to send response.'),
                    })
                  )}
                  className="space-y-2"
                >
                  <Textarea
                    rows={3}
                    placeholder="e.g. This looks like an environment/config issue, not the implementation…"
                    {...respondForm.register('response', { required: 'A response is required' })}
                  />
                  {respondForm.formState.errors.response && (
                    <p className="text-xs text-destructive">{respondForm.formState.errors.response.message}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" type="submit" loading={respondToQaRejection.isPending}>Send response</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setShowRespondToRejection(false)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => { setShowRespondToRejection(true); respondForm.reset(); }}>
                  Respond
                </Button>
              )
            ) : null}
          </CardContent>
        </Card>
      )}

      <SubtasksCard
        taskId={id!}
        task={task}
        canManage={canManageSubtasks}
        canLoan={canLoan}
        loanCandidates={loanCandidates}
        onMarkDone={handleMarkDone}
        onSendToQa={() => { setShowSendToQa(true); sendToQaForm.reset(); }}
        markDonePending={markTaskDone.isPending}
        sendToQaPending={sendToQa.isPending}
      />

      {showRejectQa && (
        <Card className="mb-4 border-orange-200">
          <ActionCardHeader icon={XCircle} title="Propose rejection" tone="orange" />
          <CardContent className="pt-4">
            <form
              onSubmit={rejectQaForm.handleSubmit((values) =>
                proposeQaRejection.mutate({ reason: values.reason, targetStage: values.targetStage || undefined }, {
                  onSuccess: () => {
                    toast.success("Rejection proposed. The original task stays in QA until you confirm or withdraw it.");
                    setShowRejectQa(false);
                    rejectQaForm.reset();
                  },
                  onError: (e) => toast.error((e as Error).message ?? 'Failed to propose rejection.'),
                })
              )}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                The original task stays in QA and nothing moves yet — the assignee can respond before you confirm or withdraw this.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="qa-reject-reason">Concern <span className="text-destructive">*</span></Label>
                <Textarea
                  id="qa-reject-reason"
                  rows={3}
                  placeholder="Describe what failed and what needs to be fixed…"
                  {...rejectQaForm.register('reason', { required: 'Reason is required' })}
                />
                {rejectQaForm.formState.errors.reason && (
                  <p className="text-xs text-destructive">{rejectQaForm.formState.errors.reason.message}</p>
                )}
              </div>
              {originalTask?.requiresFrontendHandoff && (
                <div className="space-y-1.5">
                  <Label htmlFor="qa-reject-stage">Which side is this?</Label>
                  <select id="qa-reject-stage" className={SELECT_CLS} {...rejectQaForm.register('targetStage')}>
                    <option value="">Not sure</option>
                    <option value="frontend">Frontend issue</option>
                    <option value="backend">Backend issue</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {originalTask.currentStage === 'frontend'
                      ? 'Flagging "Backend issue" automatically hands the task back to the backend engineer on confirm.'
                      : 'Informational only — this task is currently with backend, so flagging "Frontend issue" still requires a manual hand-off.'}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" type="submit" loading={proposeQaRejection.isPending}>Propose</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowRejectQa(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showBlocker && (
        <Card className="mb-4">
          <ActionCardHeader icon={AlertTriangle} title="Flag a blocker" />
          <CardContent className="pt-4">
            <form onSubmit={handleFlagBlocker} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="blocker-reason">Reason</Label>
                <Controller
                  name="reason"
                  control={blockerForm.control}
                  rules={{ required: 'Reason is required' }}
                  render={({ field }) => (
                    <MentionTextarea
                      id="blocker-reason" rows={3} placeholder="Describe what is blocking progress… (@ to mention someone)"
                      value={field.value ?? ''} onChange={field.onChange} engineers={mentionCandidates}
                    />
                  )}
                />
                {blockerForm.formState.errors.reason && (
                  <p className="text-xs text-destructive">{blockerForm.formState.errors.reason.message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" loading={flagBlocker.isPending}>Submit</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowBlocker(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showPause && (
        <Card className="mb-4">
          <ActionCardHeader icon={Pause} title="Pause task" />
          <CardContent className="pt-4">
            <form onSubmit={handlePause} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pause-note">Note (optional)</Label>
                <Input id="pause-note" placeholder="e.g. Reprioritized for the week" {...pauseForm.register('note')} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" loading={pauseTask.isPending}>Submit</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowPause(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showGroom && canGroomOwnTask && (
        <Card className="mb-4">
          <ActionCardHeader icon={Sparkles} title="Groom & activate" />
          <CardContent className="pt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              This task was created by you and needs points before it can move out of Backlog.
            </p>
            <form onSubmit={handleGroom} className="space-y-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="groom-points">Points <span className="text-destructive">*</span></Label>
                  <Input
                    id="groom-points" type="number" min={1} max={13}
                    {...groomForm.register('points', { required: 'Points is required', min: { value: 1, message: 'Must be at least 1' } })}
                  />
                  {groomForm.formState.errors.points && (
                    <p className="text-xs text-destructive">{groomForm.formState.errors.points.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Priority
                    <PriorityScaleGuide scale={meta?.priorityScale ?? []} />
                  </Label>
                  <select {...groomForm.register('priority')} className={SELECT_CLS}>
                    <option value="">Not set</option>
                    {[1, 2, 3, 4, 5].map((v) => {
                      const entry = meta?.priorityScale?.find((e) => e.value === v);
                      return (
                        <option key={v} value={v}>
                          P{v}{entry ? ` — ${entry.label}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" loading={groomOwnTask.isPending}>Save &amp; activate</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowGroom(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showAssigneeEdit && canAssigneeEdit && (
        <Card className="mb-4">
          <ActionCardHeader icon={Pencil} title="Edit description & due date" />
          <CardContent className="pt-4">
            <form onSubmit={handleAssigneeEdit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Controller
                  name="description"
                  control={assigneeEditForm.control}
                  render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" {...assigneeEditForm.register('dueDate')} />
                {task.sprintId && (
                  <p className="text-xs text-muted-foreground">Can't be later than this task's sprint end date.</p>
                )}
              </div>
              {dueDateMovesInAssigneeEdit && (
                <DueDateReasonField
                  id="assignee-due-date-reason"
                  registration={assigneeEditForm.register('dueDateChangeReason')}
                  error={assigneeEditForm.formState.errors.dueDateChangeReason?.message}
                />
              )}
              {assigneeEditForm.formState.errors.root && (
                <p className="text-sm text-destructive">{assigneeEditForm.formState.errors.root.message}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" type="submit" loading={assigneeEditTask.isPending}>Save</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowAssigneeEdit(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showAssign && canClaimForTeam && (
        <Card className="mb-4">
          <ActionCardHeader icon={UserPlus} title="Assign task to a team member" />
          <CardContent className="pt-4">
            <form onSubmit={assignForm.handleSubmit((values) =>
              assignTask.mutate({ assigneeId: values.assigneeId }, {
                onSuccess: () => { toast.success('Task assigned.'); setShowAssign(false); assignForm.reset(); },
                onError:   (e) => applyServerErrors(e, assignForm.setError),
              })
            )} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Assignee <span className="text-destructive">*</span></Label>
                <Controller
                  name="assigneeId"
                  control={assignForm.control}
                  rules={{ required: 'Select an assignee' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select a team member…"
                      emptyLabel="No matching engineers"
                      options={engineers?.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.name })) ?? []}
                    />
                  )}
                />
                {assignForm.formState.errors.assigneeId && (
                  <p className="text-xs text-destructive">{assignForm.formState.errors.assigneeId.message}</p>
                )}
              </div>
              {assignForm.formState.errors.root && (
                <p className="text-sm text-destructive">{assignForm.formState.errors.root.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" type="submit" loading={assignTask.isPending}>Assign task</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowAssign(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showHandOff && canHandOffToFrontend && (
        <Card className="mb-4">
          <ActionCardHeader icon={Shuffle} title="Hand off to Frontend" />
          <CardContent className="pt-4">
            <form onSubmit={handOffForm.handleSubmit((values) =>
              handOffToFrontend.mutate(values.frontendAssigneeId, {
                onSuccess: () => { toast.success('Task handed off to Frontend.'); setShowHandOff(false); handOffForm.reset(); },
                onError:   (e) => applyServerErrors(e, handOffForm.setError),
              })
            )} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Frontend engineer <span className="text-destructive">*</span></Label>
                <Controller
                  name="frontendAssigneeId"
                  control={handOffForm.control}
                  rules={{ required: 'Select a frontend engineer' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select a frontend engineer…"
                      emptyLabel="No Frontend-discipline engineers"
                      options={frontendHandoffCandidates?.map((e) => ({ value: e.id, label: e.onProject ? e.name : `${e.name} — not on this project yet` })) ?? []}
                    />
                  )}
                />
                {handOffForm.formState.errors.frontendAssigneeId && (
                  <p className="text-xs text-destructive">{handOffForm.formState.errors.frontendAssigneeId.message}</p>
                )}
              </div>
              {handOffForm.formState.errors.root && (
                <p className="text-sm text-destructive">{handOffForm.formState.errors.root.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" type="submit" loading={handOffToFrontend.isPending}>Hand off</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowHandOff(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showHandOffBack && canHandOffToBackend && (
        <Card className="mb-4">
          <ActionCardHeader icon={Shuffle} title="Hand off to Backend" />
          <CardContent className="pt-4">
            <form onSubmit={handOffBackForm.handleSubmit((values) =>
              handOffToBackend.mutate(values.backendAssigneeId, {
                onSuccess: () => { toast.success('Task handed off to Backend.'); setShowHandOffBack(false); handOffBackForm.reset(); },
                onError:   (e) => applyServerErrors(e, handOffBackForm.setError),
              })
            )} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Backend engineer <span className="text-destructive">*</span></Label>
                <Controller
                  name="backendAssigneeId"
                  control={handOffBackForm.control}
                  rules={{ required: 'Select a backend engineer' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select a backend engineer…"
                      emptyLabel="No Backend-discipline engineers"
                      options={backendHandoffCandidates?.map((e) => ({ value: e.id, label: e.onProject ? e.name : `${e.name} — not on this project yet` })) ?? []}
                    />
                  )}
                />
                {handOffBackForm.formState.errors.backendAssigneeId && (
                  <p className="text-xs text-destructive">{handOffBackForm.formState.errors.backendAssigneeId.message}</p>
                )}
              </div>
              {handOffBackForm.formState.errors.root && (
                <p className="text-sm text-destructive">{handOffBackForm.formState.errors.root.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" type="submit" loading={handOffToBackend.isPending}>Hand off</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowHandOffBack(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showSendToQa && task.requiresQa && (
        <Card className="mb-4">
          <ActionCardHeader icon={FlaskConical} title="Send to QA" />
          <CardContent className="pt-4">
            <form onSubmit={sendToQaForm.handleSubmit((values) =>
              sendToQa.mutate(values.qaEngineerId || undefined, {
                onSuccess: () => { toast.success('Task sent to QA. QA sub-task created.'); setShowSendToQa(false); sendToQaForm.reset(); },
                onError:   (e) => applyServerErrors(e, sendToQaForm.setError),
              })
            )} className="space-y-3">
              <div className="space-y-1.5">
                <Label>QA reviewer</Label>
                <Controller
                  name="qaEngineerId"
                  control={sendToQaForm.control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder={(() => {
                        const recommended = qaSendCandidates?.candidates.find((c) => c.id === qaSendCandidates.recommendedEngineerId);
                        return recommended ? `Auto-assign — ${recommended.name}` : 'Select a QA engineer…';
                      })()}
                      emptyLabel="No active QA engineers"
                      options={(qaSendCandidates?.candidates ?? []).map((c) => ({ value: c.id, label: c.onProject ? c.name : `${c.name} — not on this project yet` }))}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the auto-assigned reviewer, or pick a specific one.</p>
                {sendToQaForm.formState.errors.root && (
                  <p className="text-sm text-destructive">{sendToQaForm.formState.errors.root.message}</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" type="submit" loading={sendToQa.isPending}>Send to QA</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowSendToQa(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showLoan && canLoan && (
        <Card className="mb-4">
          <ActionCardHeader icon={ArrowLeftRight} title="Loan task to another department" />
          <CardContent className="pt-4">
            <form onSubmit={loanForm.handleSubmit((values) =>
              loanTask.mutate({ targetEngineerId: values.targetEngineerId, reason: values.reason || undefined }, {
                onSuccess: () => { toast.success('Task loaned successfully.'); setShowLoan(false); loanForm.reset(); },
                onError:   (e) => applyServerErrors(e, loanForm.setError),
              })
            )} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Target engineer <span className="text-destructive">*</span></Label>
                <Controller
                  name="targetEngineerId"
                  control={loanForm.control}
                  rules={{ required: 'Select a target engineer' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select engineer…"
                      emptyLabel="No matching engineers"
                      options={loanCandidates?.filter((e) => e.id !== task.assigneeId && e.isActive).map((e) => ({ value: e.id, label: e.name })) ?? []}
                    />
                  )}
                />
                {loanForm.formState.errors.targetEngineerId && (
                  <p className="text-xs text-destructive">{loanForm.formState.errors.targetEngineerId.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Reason (optional)</Label>
                <Input {...loanForm.register('reason')} placeholder="e.g. Domain expertise needed" />
              </div>
              {loanForm.formState.errors.root && (
                <p className="text-sm text-destructive">{loanForm.formState.errors.root.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" type="submit" loading={loanTask.isPending}>Loan task</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowLoan(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {preview && pendingEdit && (
        <OverworkPreviewCard
          preview={preview}
          onConfirm={() => doUpdate(pendingEdit)}
          onCancel={() => { setPendingEdit(null); setPreview(null); }}
          loading={updateTask.isPending}
        />
      )}

      {showEdit && canEdit && !preview && (
        <Card className="mb-4">
          <ActionCardHeader icon={Pencil} title="Edit task" />
          <CardContent className="pt-4">
            <form onSubmit={handleEdit} className="space-y-4">
              {task.status === 'done' && (
                <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  This task is done, so its title, description, points, dates, and assignment are locked.
                  You can still correct the QA requirement, discipline, or actual end date for the record.
                </p>
              )}
              {task.status !== 'done' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input {...editForm.register('title', { required: 'Title is required' })} />
                    {editForm.formState.errors.title && <p className="text-xs text-destructive">{editForm.formState.errors.title.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>External reference</Label>
                    <Input placeholder="e.g. JIRA-482" {...editForm.register('externalReference')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Controller
                      name="description"
                      control={editForm.control}
                      render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Acceptance criteria</Label>
                    <Controller
                      name="acceptanceCriteria"
                      control={editForm.control}
                      render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
                    />
                  </div>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignment</p>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <select {...editForm.register('type')} className={SELECT_CLS}>
                      {(meta?.taskTypes ?? []).map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {editForm.watch('type') === 'bug' && (
                    <div className="space-y-1.5">
                      <Label>Severity</Label>
                      <select {...editForm.register('severity')} className={SELECT_CLS}>
                        <option value="">No severity</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  )}
                  {!task.parentTaskId && canEdit && (
                    <div className="space-y-1.5">
                      <Label>Assignee</Label>
                      <Controller
                        name="assigneeId"
                        control={editForm.control}
                        render={({ field }) => (
                          <SearchableSelect
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Search engineers…"
                            emptyLabel="No matching engineers"
                            options={[
                              { value: '', label: 'Unassigned' },
                              ...(assignableEngineers?.map((e) => ({ value: e.id, label: e.name })) ?? []),
                            ]}
                          />
                        )}
                      />
                      {task.status === 'backlog' && (
                        <p className="text-xs text-muted-foreground">
                          Assigning a groomed (pointed) Backlog task moves it to Active automatically.
                        </p>
                      )}
                    </div>
                  )}
                  {task.parentTaskId && (
                    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
                      <label className="text-sm font-medium">Discipline</label>
                      <Controller
                        name="discipline"
                        control={editForm.control}
                        render={({ field }) => (
                          <SearchableSelect
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Search disciplines…"
                            emptyLabel="No matching disciplines"
                            options={[{ value: '', label: 'Not specified' }, ...DISCIPLINES]}
                          />
                        )}
                      />
                      <p className="text-xs text-muted-foreground">Determines which QA engineers are offered below.</p>
                      <div className="space-y-1.5 pt-1">
                        <Label>Assignee</Label>
                        <Controller
                          name="assigneeId"
                          control={editForm.control}
                          render={({ field }) => (
                            <SearchableSelect
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              disabled={parentHasNoDiscipline && !isAllowedQaAssigner}
                              placeholder="Search engineers…"
                              emptyLabel="No matching engineers"
                              options={[
                                { value: '', label: 'Unassigned' },
                                ...(assignableEngineers?.map((e) => ({ value: e.id, label: e.name })) ?? []),
                              ]}
                            />
                          )}
                        />
                        {!parentHasNoDiscipline && disciplineFilterActive && (
                          <p className="text-xs text-muted-foreground">
                            Showing {DISCIPLINES.find((d) => d.value === qaDiscipline)?.label ?? qaDiscipline} QA engineers only —{' '}
                            <button type="button" className="underline hover:text-foreground" onClick={() => setShowAllQaEngineers(true)}>
                              show all QA engineers
                            </button>
                          </p>
                        )}
                        {!parentHasNoDiscipline && !disciplineFilterActive && qaDiscipline && showAllQaEngineers && (
                          <p className="text-xs text-muted-foreground">
                            Showing all QA engineers —{' '}
                            <button type="button" className="underline hover:text-foreground" onClick={() => setShowAllQaEngineers(false)}>
                              show {DISCIPLINES.find((d) => d.value === qaDiscipline)?.label ?? qaDiscipline} only
                            </button>
                          </p>
                        )}
                        {!parentHasNoDiscipline && !disciplineFilterActive && qaDiscipline && !showAllQaEngineers && (
                          <p className="text-xs text-muted-foreground">
                            No active {DISCIPLINES.find((d) => d.value === qaDiscipline)?.label ?? qaDiscipline} QA engineers — showing all QA engineers instead.
                          </p>
                        )}
                        {!parentHasNoDiscipline && !disciplineFilterActive && !qaDiscipline && (
                          <p className="text-xs text-muted-foreground">
                            This is a QA review task — only QA engineers are shown. Pick a discipline above to narrow the list.
                          </p>
                        )}
                        {parentHasNoDiscipline && isAllowedQaAssigner && (
                          <p className="text-xs text-muted-foreground">
                            The original task has no discipline set — only QA engineers in the Product or Functional department are shown
                            {qaDiscipline ? <>, narrowed further to {DISCIPLINES.find((d) => d.value === qaDiscipline)?.label ?? qaDiscipline}</> : ''}.
                          </p>
                        )}
                        {parentHasNoDiscipline && !isAllowedQaAssigner && (
                          <p className="text-xs text-muted-foreground">
                            The original task has no discipline set, so only Head of Product, Head of PMO, or Head of Functional can reassign this QA task.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {(epics?.length ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      <Label>Epic</Label>
                      <Controller
                        name="epicId"
                        control={editForm.control}
                        render={({ field }) => (
                          <SearchableSelect
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Search epics…"
                            emptyLabel="No matching epics"
                            options={[{ value: '', label: 'No epic' }, ...epics!.map((e) => ({ value: e.id, label: e.title }))]}
                          />
                        )}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Sprint</Label>
                    <select {...editForm.register('sprintId')} className={SELECT_CLS}>
                      <option value="">No sprint</option>
                      {sprints?.filter((s) => s.status !== 'Completed' && s.projectId === task.projectId).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduling</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Points</Label>
                      <Input type="number" min={0} {...editForm.register('points')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Due date</Label>
                      <Input type="date" {...editForm.register('dueDate')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Priority
                        <PriorityScaleGuide scale={meta?.priorityScale ?? []} />
                      </Label>
                      <select {...editForm.register('priority')} className={SELECT_CLS}>
                        <option value="">Not set</option>
                        {[1, 2, 3, 4, 5].map((v) => {
                          const entry = meta?.priorityScale?.find((e) => e.value === v);
                          return (
                            <option key={v} value={v}>
                              P{v}{entry ? ` — ${entry.label}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {pointsChangeNeedsReasonInEdit && (
                    <PointsReasonField
                      id="edit-points-reason"
                      registration={editForm.register('pointsChangeReason')}
                      error={editForm.formState.errors.pointsChangeReason?.message}
                    />
                  )}
                  {dueDateMovesInEdit && (
                    <DueDateReasonField
                      id="edit-due-date-reason"
                      registration={editForm.register('dueDateChangeReason')}
                      error={editForm.formState.errors.dueDateChangeReason?.message}
                    />
                  )}
                </>
              )}
              <div className="space-y-1.5">
                <Label>Actual end date</Label>
                <Input type="date" {...editForm.register('actualEndDate')} />
              </div>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow</p>
              {!task.parentTaskId && (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    {...editForm.register('requiresQa')}
                  />
                  <span className="text-sm font-medium text-foreground">Requires QA sign-off before done</span>
                </label>
              )}
              {!task.parentTaskId && (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    {...editForm.register('requiresPrApproval')}
                  />
                  <span className="text-sm font-medium text-foreground">Requires PR approval before done</span>
                </label>
              )}
              {!task.parentTaskId && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Discipline</label>
                  <Controller
                    name="discipline"
                    control={editForm.control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Search disciplines…"
                        emptyLabel="No matching disciplines"
                        options={[{ value: '', label: 'Not specified' }, ...DISCIPLINES]}
                      />
                    )}
                  />
                </div>
              )}
              {!task.parentTaskId && (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    {...editForm.register('requiresFrontendHandoff')}
                  />
                  <span className="text-sm font-medium text-foreground">Needs a Backend → Frontend handoff</span>
                </label>
              )}
              {editForm.formState.errors.root && (
                <p className="text-sm text-destructive pt-1">{editForm.formState.errors.root.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" type="submit" loading={updateTask.isPending || previewAssign.isPending}>Save</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowEdit(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Dependencies */}
      {!task.isPersonal && ((links?.blockedBy.length ?? 0) > 0 || (links?.blocks.length ?? 0) > 0 || canAct) && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Dependencies</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {(links?.blockedBy.length ?? 0) > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Blocked by</p>
                <div className="space-y-1.5">
                  {links!.blockedBy.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                      <Link to={`/tasks/${t.id}`} className="font-medium text-foreground hover:underline">
                        {t.taskKey && <span className="font-mono text-xs text-muted-foreground">{t.taskKey} </span>}
                        {t.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.status}</span>
                        {canAct && (
                          <button onClick={() => removeDep.mutate(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(links?.blocks.length ?? 0) > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Blocks</p>
                <div className="space-y-1.5">
                  {links!.blocks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                      <Link to={`/tasks/${t.id}`} className="flex-1 font-medium text-foreground hover:underline">
                        {t.taskKey && <span className="font-mono text-xs text-muted-foreground">{t.taskKey} </span>}
                        {t.title}
                      </Link>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {canAct && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add blocking task</p>
                <div className="flex items-center gap-2">
                  <SearchableSelect
                    value={depTaskId}
                    onChange={setDepTaskId}
                    placeholder="Select a task that blocks this one…"
                    emptyLabel="No matching tasks"
                    className="flex-1"
                    options={(allTasks?.items ?? [])
                      .filter((t) => t.id !== id && !links?.blockedBy.some((b) => b.id === t.id))
                      .map((t) => ({ value: t.id, label: t.title }))}
                  />
                  <button
                    onClick={() => {
                      if (!depTaskId) return;
                      addDep.mutate(depTaskId, {
                        onSuccess: () => { toast.success('Dependency added.'); setDepTaskId(''); },
                        onError:   (e: unknown) => toast.error((e as Error).message ?? 'Failed to add dependency.'),
                      });
                    }}
                    disabled={!depTaskId || addDep.isPending}
                    className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Planning Poker */}
      {task.status !== 'done' && !task.isPersonal && <PlanningPokerPanel taskId={id!} canLead={canEdit} currentUserId={currentUser!.id} hasDueDate={!!task.dueDate} isAssignee={task.assigneeId === currentUser!.id} />}

      {/* PR Approval */}
      {task.requiresPrApproval && task.status !== 'done' && <PrApprovalPanel taskId={id!} task={task} canAct={canAct} />}

      {/* Comments */}
      <CommentsThread taskId={id!} currentUserId={currentUser!.id} canModerate={canEdit} engineers={mentionCandidates} />

      {/* Feedback — about delivery work, so not on a private to-do */}
      {!task.isPersonal && <Card className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40"
          onClick={() => setShowFeedback((v) => !v)}
        >
          <span>Leave feedback on this task</span>
          <span className="text-muted-foreground text-xs">{showFeedback ? '▼' : '▲'}</span>
        </button>
        {showFeedback && (
          <form onSubmit={handleFeedback} className="border-t border-border px-5 pb-5 pt-4">
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Feedback is readable only by department heads. This is enforced at the API level.
            </p>
            <div className="mb-3 space-y-1.5">
              <Label htmlFor="feedback-text">Your feedback</Label>
              <Textarea id="feedback-text" rows={4} placeholder="What went well? What could be improved?"
                {...feedbackForm.register('text', { required: 'Feedback text is required' })} />
              {feedbackForm.formState.errors.text && (
                <p className="text-xs text-destructive">{feedbackForm.formState.errors.text.message}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" loading={submitFeedback.isPending}>Submit</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => { setShowFeedback(false); feedbackForm.reset(); }}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>}
      </div>

      {/* Details rail */}
      <aside className="w-full shrink-0 lg:w-72">
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <span className="text-muted-foreground">Project</span>
                <span className="text-right font-medium text-foreground">{proj?.name ?? task.projectName ?? '—'}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Assignee</span>
                <span className="text-right font-medium text-foreground">{eng?.name ?? task.assigneeName ?? 'Unassigned'}</span>
              </div>
              {task.assignedAt && (
                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                  <span className="text-muted-foreground">Assigned</span>
                  <span className="text-right font-mono tabular-nums font-medium text-foreground">{formatDate(task.assignedAt)}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Created by</span>
                <span className="text-right font-medium text-foreground">{task.creatorName ?? '—'}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Created</span>
                <span className="text-right font-mono tabular-nums font-medium text-foreground">{formatDate(task.createdAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Sprint</span>
                <span className="text-right font-medium text-foreground">
                  {task.sprintId ? (
                    <Link to={`/sprints/${task.sprintId}`} className="hover:text-primary hover:underline">
                      {sprints?.find((s) => s.id === task.sprintId)?.name ?? task.sprintId.slice(0, 8)}
                    </Link>
                  ) : '—'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Due date</span>
                <span className="text-right font-mono tabular-nums font-medium text-foreground">{formatDate(task.dueDate)}</span>
              </div>
              {task.dueDateChange && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="due-date-change-note">
                  <span className="font-medium text-foreground">Due date changed</span>
                  {' '}
                  {task.dueDateChange.from ? `from ${formatDate(task.dueDateChange.from)} ` : ''}
                  {task.dueDateChange.to ? `to ${formatDate(task.dueDateChange.to)} ` : ''}
                  by {task.dueDateChange.changedByName ?? 'someone'} on {formatDate(task.dueDateChange.changedAt)}.
                  {' '}Reason: {task.dueDateChange.reason}
                </p>
              )}
              {task.pointsChange && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="points-change-note">
                  <span className="font-medium text-foreground">Points changed</span>
                  {' '}
                  {task.pointsChange.from != null ? `from ${task.pointsChange.from} ` : ''}
                  {task.pointsChange.to != null ? `to ${task.pointsChange.to} ` : ''}
                  by {task.pointsChange.changedByName ?? 'someone'} on {formatDate(task.pointsChange.changedAt)}.
                  {' '}Reason: {task.pointsChange.reason}
                </p>
              )}
              {task.backendAssigneeId && (
                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                  <span className="text-muted-foreground">Backend by</span>
                  <span className="text-right font-medium text-foreground">{task.backendAssigneeName ?? '—'}</span>
                </div>
              )}
              {task.sentToQaAt && (
                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                  <span className="text-muted-foreground">Sent to QA</span>
                  <span className="text-right font-mono tabular-nums font-medium text-foreground">{formatDate(task.sentToQaAt)}</span>
                </div>
              )}
              {task.actualEndDate && (
                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                  <span className="text-muted-foreground">Actual end</span>
                  <span className="text-right font-mono tabular-nums font-medium text-foreground">{formatDate(task.actualEndDate)}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Activated</span>
                <span className="text-right font-mono tabular-nums font-medium text-foreground">{formatDate(task.activatedAt)}</span>
              </div>
              {thresholds && task.status !== 'done' && (() => {
                const esc = computeEscalationStatus(task, thresholds);
                return esc ? (
                  <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                    <span className="text-muted-foreground">Escalation</span>
                    <span className={cn('text-right text-sm', esc.cls)}>{esc.label}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </CardContent>
        </Card>
      </aside>
      </div>
    </div>
  );
}
