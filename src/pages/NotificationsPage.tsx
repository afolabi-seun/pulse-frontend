import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowRight, AtSign, BarChart2, Bell,
  CheckCircle2, ClipboardList, FlaskConical, GitPullRequest, KeyRound, MessageSquare, ShieldAlert, Shuffle, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../api/notifications';
import { useCursorPagination } from '../hooks/useCursorPagination';
import TaskPreviewDrawer from '../components/tasks/TaskPreviewDrawer';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDateTime } from '../lib/dates';
import type { NotificationDto } from '../types/api';

// ── Kind metadata ─────────────────────────────────────────────────────────────

const KIND_ICON: Record<string, LucideIcon> = {
  checkin_reminder:    Bell,
  escalation_t3:       AlertTriangle,
  escalation_t1:       AlertCircle,
  escalation_overdue:  AlertCircle,
  blocker_flagged:     AlertTriangle,
  weekly_vitals_prompt: BarChart2,
  weekly_report_ready: BarChart2,
  password_reset:      KeyRound,
  account_locked:      ShieldAlert,
  qa_rejected:         XCircle,
  qa_rejection_proposed:  AlertTriangle,
  qa_rejection_responded: ClipboardList,
  qa_rejection_withdrawn: CheckCircle2,
  qa_accepted:         FlaskConical,
  qa_unassigned:       FlaskConical,
  task_unblocked:      CheckCircle2,
  task_assigned:       ClipboardList,
  task_loaned:         ArrowRight,
  task_recalled:       ArrowRight,
  mentioned:           AtSign,
  estimate_approval_requested: Shuffle,
  estimate_approval_escalated: Shuffle,
  estimate_approved:   CheckCircle2,
  estimate_rejected:   XCircle,
  feedback_replied:    MessageSquare,
  pr_approval_requested: GitPullRequest,
  pr_approval_approved:  CheckCircle2,
  pr_approval_rejected:  XCircle,
  pr_approval_reassigned: GitPullRequest,
};

const KIND_ICON_BG: Record<string, string> = {
  checkin_reminder:    'bg-primary/10',
  escalation_t3:       'bg-amber-50 dark:bg-amber-950/40',
  escalation_t1:       'bg-red-50 dark:bg-red-950/40',
  escalation_overdue:  'bg-red-50 dark:bg-red-950/40',
  blocker_flagged:     'bg-red-50 dark:bg-red-950/40',
  weekly_vitals_prompt: 'bg-violet-50 dark:bg-violet-950/40',
  weekly_report_ready: 'bg-emerald-50 dark:bg-emerald-950/40',
  password_reset:      'bg-muted',
  account_locked:      'bg-amber-50 dark:bg-amber-950/40',
  qa_rejected:         'bg-red-50 dark:bg-red-950/40',
  qa_rejection_proposed:  'bg-amber-50 dark:bg-amber-950/40',
  qa_rejection_responded: 'bg-primary/10',
  qa_rejection_withdrawn: 'bg-emerald-50 dark:bg-emerald-950/40',
  qa_accepted:         'bg-emerald-50 dark:bg-emerald-950/40',
  qa_unassigned:       'bg-amber-50 dark:bg-amber-950/40',
  task_unblocked:      'bg-emerald-50 dark:bg-emerald-950/40',
  task_assigned:       'bg-primary/10',
  task_loaned:         'bg-violet-50 dark:bg-violet-950/40',
  task_recalled:       'bg-amber-50 dark:bg-amber-950/40',
  mentioned:           'bg-indigo-50 dark:bg-indigo-950/40',
  estimate_approval_requested: 'bg-amber-50 dark:bg-amber-950/40',
  estimate_approval_escalated: 'bg-red-50 dark:bg-red-950/40',
  estimate_approved:   'bg-emerald-50 dark:bg-emerald-950/40',
  estimate_rejected:   'bg-red-50 dark:bg-red-950/40',
  feedback_replied:    'bg-primary/10',
  pr_approval_requested: 'bg-amber-50 dark:bg-amber-950/40',
  pr_approval_approved:  'bg-emerald-50 dark:bg-emerald-950/40',
  pr_approval_rejected:  'bg-red-50 dark:bg-red-950/40',
  pr_approval_reassigned: 'bg-amber-50 dark:bg-amber-950/40',
};

const KIND_ICON_CLS: Record<string, string> = {
  checkin_reminder:    'text-primary',
  escalation_t3:       'text-amber-500',
  escalation_t1:       'text-red-500',
  escalation_overdue:  'text-red-500',
  blocker_flagged:     'text-red-500',
  weekly_vitals_prompt: 'text-violet-600 dark:text-violet-400',
  weekly_report_ready: 'text-emerald-600 dark:text-emerald-400',
  password_reset:      'text-muted-foreground',
  account_locked:      'text-amber-500',
  qa_rejected:         'text-red-500',
  qa_rejection_proposed:  'text-amber-500',
  qa_rejection_responded: 'text-primary',
  qa_rejection_withdrawn: 'text-emerald-600 dark:text-emerald-400',
  qa_accepted:         'text-emerald-600 dark:text-emerald-400',
  qa_unassigned:       'text-amber-500',
  task_unblocked:      'text-emerald-600 dark:text-emerald-400',
  task_assigned:       'text-primary',
  task_loaned:         'text-violet-600 dark:text-violet-400',
  task_recalled:       'text-amber-500',
  mentioned:           'text-indigo-600 dark:text-indigo-400',
  estimate_approval_requested: 'text-amber-500',
  estimate_approval_escalated: 'text-red-500',
  estimate_approved:   'text-emerald-600 dark:text-emerald-400',
  estimate_rejected:   'text-red-500',
  feedback_replied:    'text-primary',
  pr_approval_requested: 'text-amber-500',
  pr_approval_approved:  'text-emerald-600 dark:text-emerald-400',
  pr_approval_rejected:  'text-red-500',
  pr_approval_reassigned: 'text-amber-500',
};

const KIND_TITLE: Record<string, string> = {
  checkin_reminder:    'Check-in reminder',
  escalation_t3:       'Task approaching due date',
  escalation_t1:       'Task due soon',
  escalation_overdue:  'Task overdue',
  blocker_flagged:     'Blocker flagged',
  weekly_vitals_prompt: 'Weekly vitals survey ready',
  weekly_report_ready: 'Weekly leadership report ready',
  password_reset:      'Password reset requested',
  account_locked:      'Account locked',
  qa_rejected:         'QA rejected — rework required',
  qa_rejection_proposed:  'QA raised a concern — response needed',
  qa_rejection_responded: 'Assignee responded to your QA concern',
  qa_rejection_withdrawn: 'QA rejection withdrawn — review continues',
  qa_accepted:         'QA passed — task complete',
  qa_unassigned:       'Your QA task has no reviewer yet',
  task_unblocked:      'Task unblocked — ready to proceed',
  task_assigned:       'Task assigned to you',
  task_loaned:         'Task loaned to you from another department',
  task_recalled:       'A task loaned to you was recalled',
  mentioned:           'You were mentioned',
  estimate_approval_requested: 'Estimate awaiting your approval',
  estimate_approval_escalated: 'Estimate approval overdue — needs your attention',
  estimate_approved:   'Your estimate was approved',
  estimate_rejected:   'Your estimate was rejected',
  feedback_replied:    'You received a reply to your feedback',
  pr_approval_requested: 'PR awaiting your approval',
  pr_approval_approved:  'Your PR was approved',
  pr_approval_rejected:  'Your PR was rejected',
  pr_approval_reassigned: 'A PR approval was reassigned to you',
};

// Kinds that link to a task (row is clickable, auto-marks read on click)
const TASK_LINK_KINDS = new Set([
  'escalation_t1', 'escalation_t3', 'escalation_overdue', 'blocker_flagged',
  'qa_accepted', 'task_unblocked', 'task_assigned', 'qa_rejected', 'qa_unassigned', 'task_loaned', 'task_recalled',
  'mentioned', 'qa_rejection_proposed', 'qa_rejection_responded', 'qa_rejection_withdrawn',
  'estimate_approval_requested', 'estimate_approval_escalated', 'estimate_approved', 'estimate_rejected',
  'pr_approval_requested', 'pr_approval_approved', 'pr_approval_rejected', 'pr_approval_reassigned',
]);

const ESCALATION_KINDS = new Set([
  'escalation_t1', 'escalation_t3', 'escalation_overdue', 'blocker_flagged',
]);

const TASK_UPDATE_KINDS = new Set([
  'task_assigned', 'task_unblocked', 'qa_accepted', 'qa_rejected', 'qa_unassigned', 'task_loaned', 'task_recalled',
  'mentioned', 'qa_rejection_proposed', 'qa_rejection_responded', 'qa_rejection_withdrawn',
  'estimate_approval_requested', 'estimate_approval_escalated', 'estimate_approved', 'estimate_rejected',
  'pr_approval_requested', 'pr_approval_approved', 'pr_approval_rejected', 'pr_approval_reassigned',
]);

// ── Date grouping ─────────────────────────────────────────────────────────────

const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Older'] as const;
type DateGroup = (typeof DATE_GROUP_ORDER)[number];

function getDateGroup(sentAt: string): DateGroup {
  const d = new Date(sentAt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart  = new Date(todayStart.getTime() - 86_400_000);
  const weekStart  = new Date(todayStart.getTime() - 6 * 86_400_000);
  if (d >= todayStart) return 'Today';
  if (d >= yestStart)  return 'Yesterday';
  if (d >= weekStart)  return 'This week';
  return 'Older';
}

// ── Payload helper ────────────────────────────────────────────────────────────

function parsePayload(n: NotificationDto): {
  taskId?: string; taskTitle?: string; reason?: string;
  rejectedByName?: string; flaggedByName?: string; mentionedByName?: string;
  repliedByName?: string; replyText?: string;
  points?: number; assigneeName?: string; teamLeadName?: string;
} {
  if (!n.payload) return {};
  try {
    const p = JSON.parse(n.payload) as Record<string, unknown>;
    return {
      taskId:          p['taskId']          as string | undefined,
      taskTitle:       p['taskTitle']       as string | undefined,
      reason:          p['reason']          as string | undefined,
      rejectedByName:  p['rejectedByName']  as string | undefined,
      flaggedByName:   p['flaggedByName']   as string | undefined,
      mentionedByName: p['mentionedByName'] as string | undefined,
      repliedByName:   p['repliedByName']   as string | undefined,
      replyText:       p['replyText']       as string | undefined,
      points:          p['points']          as number | undefined,
      assigneeName:    p['assigneeName']    as string | undefined,
      teamLeadName:    p['teamLeadName']    as string | undefined,
    };
  } catch { return {}; }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'escalations' | 'tasks';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',         label: 'All'         },
  { id: 'unread',      label: 'Unread'      },
  { id: 'escalations', label: 'Escalations' },
  { id: 'tasks',       label: 'Task updates'},
];

// ── NotificationItem ──────────────────────────────────────────────────────────

function NotificationItem({ n, onMarkRead, onOpenTask }: {
  n: NotificationDto; onMarkRead: () => void; onOpenTask: (taskId: string) => void;
}) {
  const navigate   = useNavigate();
  const { taskId, taskTitle, reason, rejectedByName, flaggedByName, mentionedByName, repliedByName, replyText, points, assigneeName, teamLeadName } = parsePayload(n);
  const isTaskLink  = TASK_LINK_KINDS.has(n.kind) && !!taskId;
  const isT1        = n.kind === 'escalation_t1';
  const isQaRej     = n.kind === 'qa_rejected' || n.kind === 'estimate_rejected';
  const isLoaned    = n.kind === 'task_loaned';
  const isBlocked   = n.kind === 'blocker_flagged';
  const isMentioned = n.kind === 'mentioned';
  const isFeedbackReply = n.kind === 'feedback_replied';
  const isEstimateEscalated = n.kind === 'estimate_approval_escalated';

  const title   = KIND_TITLE[n.kind]    ?? n.kind.replace(/_/g, ' ');
  const Icon    = KIND_ICON[n.kind]     ?? Bell;
  const iconBg  = KIND_ICON_BG[n.kind]  ?? 'bg-muted';
  const iconCls = KIND_ICON_CLS[n.kind] ?? 'text-muted-foreground';

  const handleRowClick = () => {
    if (!isTaskLink || !taskId) return;
    if (!n.isRead) onMarkRead();
    onOpenTask(taskId);
  };

  return (
    <div
      role={isTaskLink ? 'button' : undefined}
      tabIndex={isTaskLink ? 0 : undefined}
      onClick={isTaskLink ? handleRowClick : undefined}
      onKeyDown={isTaskLink ? (e) => e.key === 'Enter' && handleRowClick() : undefined}
      className={cn(
        'flex items-center gap-2.5 px-4 py-2.5 transition-colors',
        !n.isRead && 'bg-primary/5',
        isTaskLink && 'cursor-pointer hover:bg-muted/60',
      )}
    >
      {/* Icon */}
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', iconCls)} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-[13px] leading-snug', n.isRead ? 'text-muted-foreground' : 'font-medium text-foreground')}>
            {title}
          </p>
          {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          {taskTitle && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">— {taskTitle}</span>
          )}
        </div>

        {(isQaRej || isBlocked) && reason && (
          <p className="mt-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] leading-snug text-red-700 dark:bg-red-950/20 dark:text-red-400">
            {(rejectedByName ?? flaggedByName) && <span className="font-medium">{rejectedByName ?? flaggedByName}: </span>}
            {reason}
          </p>
        )}

        {isMentioned && reason && (
          <p className="mt-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] leading-snug text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">
            {mentionedByName && <span className="font-medium">{mentionedByName}: </span>}
            {reason}
          </p>
        )}

        {isLoaned && reason && (
          <p className="mt-1 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] leading-snug text-violet-700 dark:bg-violet-950/20 dark:text-violet-400">
            {reason}
          </p>
        )}

        {isEstimateEscalated && points != null && (
          <p className="mt-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] leading-snug text-red-700 dark:bg-red-950/20 dark:text-red-400">
            {points} pts{assigneeName ? ` for ${assigneeName}` : ''}{teamLeadName ? ` — waiting on ${teamLeadName}` : ''}
          </p>
        )}

        {isFeedbackReply && replyText && (
          <p className="mt-1 rounded bg-primary/5 px-1.5 py-0.5 text-[11px] leading-snug text-foreground">
            {repliedByName && <span className="font-medium text-primary">{repliedByName}: </span>}
            {replyText}
          </p>
        )}

        {/* T1 quick-action buttons */}
        {isT1 && taskId && (
          <div className="mt-1.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onMarkRead}
              className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              On track
            </button>
            <button
              type="button"
              onClick={() => navigate(`/tasks/${taskId}`)}
              className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-950/40 dark:text-red-400"
            >
              I have a blocker
            </button>
          </div>
        )}
      </div>

      {/* Trailing: timestamp, plus arrow for task links or mark-read for others */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] text-muted-foreground">{formatDateTime(n.sentAt)}</span>
        {isTaskLink && !isT1 ? (
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
        ) : !n.isRead && !isT1 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
            className="rounded text-[11px] text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Mark read
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination();
  const { data, isLoading, error, refetch } = useNotifications(cursor);
  const markRead    = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const allItems = data?.items ?? [];

  const unreadCount = useMemo(() => allItems.filter((n) => !n.isRead).length, [allItems]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'unread':      return allItems.filter((n) => !n.isRead);
      case 'escalations': return allItems.filter((n) => ESCALATION_KINDS.has(n.kind));
      case 'tasks':       return allItems.filter((n) => TASK_UPDATE_KINDS.has(n.kind));
      default:            return allItems;
    }
  }, [allItems, activeTab]);

  // Group filtered items by date
  const grouped = useMemo(() => {
    const map = new Map<DateGroup, NotificationDto[]>();
    for (const n of filtered) {
      const g = getDateGroup(n.sentAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    }
    return DATE_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [filtered]);

  const hasUnread = allItems.some((n) => !n.isRead);

  if (isLoading) return <CardListSkeleton count={6} hasAction={false} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        actions={
          hasUnread ? (
            <Button size="sm" variant="ghost" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden p-0">
        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative px-3.5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                activeTab === tab.id
                  ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.id === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={activeTab === 'unread' ? 'All caught up' : 'No notifications'}
            description={activeTab === 'unread' ? 'No unread notifications.' : 'Nothing here yet.'}
          />
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                {/* Date group header */}
                <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </p>
                <div className="divide-y divide-border">
                  {items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      n={n}
                      onMarkRead={() => markRead.mutate(n.id)}
                      onOpenTask={setPreviewTaskId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Pagination
        hasPrev={hasPrev}
        hasMore={data?.hasMore ?? false}
        onPrev={goPrev}
        onNext={() => data?.nextCursor && goNext(data.nextCursor)}
        page={pageNumber}
      />

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} nonModal />
    </div>
  );
}
