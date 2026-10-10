import { dueThisCycleHelp } from '../components/workload/WorkloadFigures';
import { useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Activity, AlertCircle, AlertTriangle, Building2, Calendar, CheckSquare, ChevronDown, ChevronUp, ClipboardCheck, Clock, Flame, FlaskConical, FolderKanban, FolderOpen, Gauge, GitPullRequest, ShieldAlert, Shuffle, TestTube2, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrentRole } from '../hooks/useCurrentRole';
import { useCursorPagination } from '../hooks/useCursorPagination';
import { useTaskList, useAllTasks, useQaQueue, useMyFrontendHandoffs } from '../api/tasks';
import { useEngineer, useEngineerSignals } from '../api/engineers';
import { useCheckInHistory, useStandupSummary } from '../api/checkIns';
import { useTimeEntriesInRange } from '../api/timeEntries';
import { useFollowedProjects, useMyProjects } from '../api/projects';
import { useMyPerformance } from '../api/performance';
import { usePmoReport, useOrgTrend } from '../api/reports';
import { useSprintList } from '../api/sprints';
import { useEscalations } from '../api/escalations';
import TaskPreviewDrawer from '../components/tasks/TaskPreviewDrawer';
import Badge from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { DashboardSkeleton, Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../components/ui/ErrorState';
import HelpTooltip from '../components/ui/HelpTooltip';
import StatCard, { STAT_GRID } from '../components/ui/StatCard';
import DashboardBanner, { type BannerHeadline } from '../components/dashboard/DashboardBanner';
import { Card, CardContent } from '@/components/ui/card';
import { cn, stripHtml } from '@/lib/utils';
import { formatDate, daysLate, todayIso, toIsoDate, isCurrentWeek } from '../lib/dates';
import type { FollowedProjectDto, MyProjectDto, PerformanceMetricsDto, ProjectHealthDto, TaskDto, TaskStatus } from '../types/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Filler);

const VELOCITY_CHART_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Points', font: { size: 9 } } },
  },
};

const TREND_LINE_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Escalations', font: { size: 9 } } },
  },
};

const HEALTH_VARIANT: Record<ProjectHealthDto['health'], 'green' | 'yellow' | 'red'> = {
  Healthy: 'green',
  AtRisk:  'yellow',
  Critical: 'red',
};

const HEALTH_LABEL: Record<ProjectHealthDto['health'], string> = {
  Healthy: 'Healthy',
  AtRisk:  'At Risk',
  Critical: 'Critical',
};

const MY_TASKS_PAGE_SIZE = 10;

/** Collapse state for a Dashboard section, persisted per-browser so it survives a reload. */
function usePersistedCollapse(key: string, defaultExpanded: boolean) {
  const storageKey = `pulse-dashboard-collapse-${key}`;
  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true' || stored === 'false') return stored === 'true';
    } catch {}
    return defaultExpanded;
  });

  const toggle = () => setExpanded((v) => {
    const next = !v;
    try { localStorage.setItem(storageKey, String(next)); } catch {}
    return next;
  });

  return [expanded, toggle] as const;
}

function formatPct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

const STATUS_VARIANT: Record<TaskStatus, 'green' | 'red' | 'gray' | 'yellow'> = {
  backlog: 'gray',
  active:  'green',
  blocked: 'red',
  inQa:    'gray',
  done:    'gray',
  paused:  'yellow',
};

export default function DashboardPage() {
  const { currentUser, allow } = useAuth();
  const { isHeadOfPmo, isTeamLead, role } = useCurrentRole();
  const id          = currentUser!.id;
  const isExecutive = allow('executive-read');
  const isHr        = allow('hr-read');
  const isAccountant = allow('accountant-read');
  // ProjectManager/ProductManager are org-wide roles (ProjectAccessPolicy.GlobalRoles) but aren't
  // a "head" role for capability purposes, so — like Team Lead below — they need their own check.
  // GetPmoReportQuery already treats them as org-wide (isPmo flag), so /reports/pmo never returns
  // an empty/scoped report for them; without this they had no Dashboard project data at all
  // (no My projects, since they manage via /projects instead).
  const isPmOrgWide  = role === 'project_manager' || role === 'product_manager';
  // Who sees the Organization overview: any department head, Executive/HR/Accountant (read-only,
  // org-wide — GetPmoReportQuery/GetStandupSummaryQuery already treat Accountant as org-wide same
  // as Executive/HR, so this just catches the Dashboard up to access it already had everywhere
  // else), a team lead (scoped to their own team by the same /reports/pmo endpoint — team leads
  // aren't a "head" role for capability purposes, so this needs its own check), and PM/ProductManager.
  const isHead       = allow('any-head');
  const isOrgViewer  = isHead || isExecutive || isHr || isAccountant || isTeamLead || isPmOrgWide;
  // Followed projects is each head's/lead's own personal watchlist — team leads and department
  // heads follow projects outside their own team/department, and PM/ProductManager/HeadOfPmo can
  // now follow too even though they already see everything (see ProjectFollow's backend doc
  // comment) — it's a quick-access bookmark list, not an access grant, for whichever specific
  // projects they're actively driving. Starts collapsed for those org-wide roles specifically
  // (see followedDefaultExpanded below) so it doesn't visually compete with Organization above it
  // until they've actually followed something.
  const canFollowProjects = allow('project-follow');
  const followedDefaultExpanded = !(isPmOrgWide || isHeadOfPmo);
  const isPm         = allow('pm-or-above');
  // PMO manages projects and people, not a personal task queue, and Executive/HR/Accountant have
  // no personal workload at all — unlike other department heads (R&D, Design, Product, Functional),
  // who do carry assigned work.
  const hidePersonal = isHeadOfPmo || isExecutive || isHr || isAccountant;
  const canLogTime   = allow('time-entry-submitter');
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [velocityExpanded, setVelocityExpanded] = useState(true);
  const [followedExpanded, toggleFollowed] = usePersistedCollapse('followed', followedDefaultExpanded);
  const [orgExpanded, toggleOrg]           = usePersistedCollapse('organization', true);
  const [myTasksExpanded, toggleMyTasks]   = usePersistedCollapse('my-tasks', true);
  const [myPerfExpanded, toggleMyPerf]     = usePersistedCollapse('my-performance', true);

  const { data: engineer }                                = useEngineer(id);
  // Was capped at 100 with no pagination — an engineer with more active/blocked tasks than that
  // had their workload/blocked stats silently undercounted below. useAllTasks pages through
  // everything instead, the same fix already applied to the Engineer Detail page's task list.
  const { items: stats, isLoading, error, refetch }       = useAllTasks({ assigneeId: id, excludeDone: true, limit: 100 });
  const { data: signals }                                 = useEngineerSignals(id);
  const { data: checkIns }                                = useCheckInHistory(id);
  const { data: followedProjects, isLoading: followedLoading } = useFollowedProjects(canFollowProjects);
  const { data: myProjects,       isLoading: myProjectsLoading } = useMyProjects();
  const { data: qaQueue,          isLoading: qaQueueLoading }    = useQaQueue({ enabled: engineer?.isQa === true });
  const { data: myHandoffs,       isLoading: myHandoffsLoading } = useMyFrontendHandoffs({ enabled: !hidePersonal });
  const { data: pmoReport,        isLoading: pmoLoading }       = usePmoReport(undefined, undefined, isOrgViewer);
  const { data: allSprints,       isLoading: sprintsLoading }   = useSprintList(undefined, undefined, isOrgViewer);
  const { data: orgEscalations }  = useEscalations(isOrgViewer);
  const { data: standup,          isLoading: standupLoading }   = useStandupSummary(undefined, undefined, isOrgViewer);
  const { data: myPerformance,    isLoading: myPerformanceLoading } = useMyPerformance(30, !hidePersonal);
  const { data: orgTrend,         isLoading: orgTrendLoading }   = useOrgTrend(isExecutive || isHr);

  // This week's Monday–Sunday bounds, for the "no time logged yet" nudge below.
  const now         = new Date();
  const dow         = now.getDay();
  const weekStart   = new Date(now);
  weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const weekEnd     = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const { data: weekTimeEntries } = useTimeEntriesInRange(toIsoDate(weekStart), toIsoDate(weekEnd), id, canLogTime);

  const { cursor: myTasksCursor, hasPrev: myTasksHasPrev, pageNumber: myTasksPage, goNext: myTasksGoNext, goPrev: myTasksGoPrev, reset: myTasksCursorReset } = useCursorPagination();
  // Finishing a task removes it from this list by default (it's meant to answer "what's still on
  // my plate"), which reads as the task having vanished with no trace right after completing it —
  // this toggle is the escape hatch back to "show me what I just did".
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const { data: myTasks, isLoading: myTasksLoading } = useTaskList({
    assigneeId: id,
    excludeDone: !showCompletedTasks,
    limit: MY_TASKS_PAGE_SIZE,
    cursor: myTasksCursor,
  });

  const activeTasks   = stats;
  const blockedTasks  = activeTasks.filter((t) => t.status === 'blocked');
  // Workload points must match the backend's own definition of active workload
  // (TaskStatusExtensions.CountsAsActiveWorkload — Active + Blocked only, excluding InQa/Paused),
  // not every non-Done task — otherwise this number drifts from the server-computed totalPoints
  // a team lead sees for the same engineer on the Engineers roster.
  const workloadTasks = activeTasks.filter((t) => t.status === 'active' || t.status === 'blocked');
  const totalPoints   = workloadTasks.reduce((s, t) => s + t.points, 0);
  const baseline      = engineer?.baselinePoints ?? 0;
  // What the overwork signal judges is the part of the load due this cycle, not everything active — the tile, the bar
  // and the flag are all driven by that one number, and the total stays alongside it so neither is hidden.
  const cyclePoints   = signals?.workload?.cyclePoints ?? totalPoints;
  const cyclePct      = baseline > 0 ? Math.min((cyclePoints / baseline) * 100, 150) : 0;

  const todayIsoValue  = todayIso();
  const checkedInToday = checkIns?.items.some((c) => c.date === todayIsoValue);
  const loggedTimeThisWeek = (weekTimeEntries?.items.length ?? 0) > 0;
  const overworked     = signals?.isOverworked ?? false;
  const signalCount    = signals
    ? [signals.loadVsBaseline, signals.concurrent, signals.staleInProgress].filter((s) => s.tripped).length
    : 0;

  const atRiskProjects   = (pmoReport?.projects ?? []).filter((p) => p.health !== 'Healthy');
  const overworkedCount  = (pmoReport?.teams ?? []).reduce((s, t) => s + t.overworkedCount, 0);
  const pointsDelta      = pmoReport ? pmoReport.totalDeliveredPoints - pmoReport.previousWeekPoints : 0;
  const highPriorityCount = (pmoReport?.projects ?? []).reduce((s, p) => s + p.highPriorityOpenTasks, 0);
  // Scope to the same teams pmoReport already scoped to (org-wide for PMO/Product heads, the
  // caller's own team otherwise) — a raw, unfiltered sprint list would leak other departments'
  // sprints right next to a correctly-scoped project list.
  const scopedTeamIds    = new Set((pmoReport?.teams ?? []).map((t) => t.teamId));
  const activeSprints    = (allSprints ?? []).filter((s) => s.status === 'Active' && scopedTeamIds.has(s.teamId));

  const topBlockers = [...(pmoReport?.blockerAging ?? [])]
    .sort((a, b) => b.daysBlocked - a.daysBlocked)
    .slice(0, 4);

  // Most recent (last) week in each team's 4-week window, aggregated into one org/department
  // check-in count for today's glance rather than a 4-week history — that stays on the full report.
  const currentCompliance = (pmoReport?.checkInCompliance ?? []).map((t) => ({
    teamId: t.teamId,
    teamName: t.teamName,
    ...t.weeks[t.weeks.length - 1],
  }));
  const missingToday = standup?.missingEngineers.length ?? 0;
  const complianceWeekInProgress = !!pmoReport?.weekOf && isCurrentWeek(pmoReport.weekOf);

  const mostUrgentEscalation = (orgEscalations ?? []).reduce<number | null>(
    (min, e) => (min === null || e.daysUntilDue < min ? e.daysUntilDue : min), null);

  // Executive's Organization section trades the operational detail (blocker list, per-team check-in
  // compliance, per-team velocity bars) heads/leads act on for strategic, org-wide shape: a
  // portfolio health breakdown and 6-week delivery/escalation trends — see project_pulse_executive_menu_access.
  const portfolioHealthy  = (pmoReport?.projects ?? []).filter((p) => p.health === 'Healthy').length;
  const portfolioAtRisk   = (pmoReport?.projects ?? []).filter((p) => p.health === 'AtRisk').length;
  const portfolioCritical = (pmoReport?.projects ?? []).filter((p) => p.health === 'Critical').length;
  const deliveryTrend    = orgTrend?.deliveryTrend ?? [];
  const escalationTrend  = orgTrend?.escalationTrend ?? [];

  // The one number the banner leads with: a person's own load against their baseline, or — for the roles with no
  // personal workload — what the organization delivered this week.
  const headline: BannerHeadline | undefined = !hidePersonal && baseline > 0
    ? {
        // Without the signal's figures the number is everything active, so it isn't called "due this cycle".
        label: signals?.workload ? 'Due this cycle' : 'Active workload',
        value: `${cyclePoints} / ${baseline}`,
        unit: 'pts',
        sub: `${Math.round((cyclePoints / baseline) * 100)}% of your baseline`,
        tone: overworked ? 'bad' : undefined,
      }
    : hidePersonal && pmoReport
      ? {
          label: 'Delivered this week',
          value: pmoReport.totalDeliveredPoints,
          unit: 'pts',
          sub: `${pointsDelta >= 0 ? '+' : '−'}${Math.abs(pointsDelta)} vs last week`,
        }
      : undefined;

  if (isLoading) return <DashboardSkeleton />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-6xl space-y-4">
      <DashboardBanner
        title={`Good ${greeting()}, ${currentUser!.name.split(' ')[0]}`}
        description={hidePersonal ? "Here's your organization at a glance." : "Here's your workload at a glance."}
        headline={headline}
      />

      {/* Check-in nudge — Executive/HR/Accountant have no check-in obligation, same reasoning as
          hiding Check In/Check-in History from their sidebar. */}
      {!isExecutive && !isHr && !isAccountant && !checkedInToday && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">You haven't submitted your check-in today.</p>
          </div>
          <Link
            to="/check-in"
            className="ml-4 shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Submit now
          </Link>
        </div>
      )}

      {/* Time-logging nudge */}
      {canLogTime && !loggedTimeThisWeek && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">You haven't logged any time this week.</p>
          </div>
          <Link
            to="/my-time"
            className="ml-4 shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Log time
          </Link>
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-4', !hidePersonal && 'lg:grid-cols-3')}>
        {/* Primary column — the section a role actually uses the dashboard for leads. Heads and
            team leads mostly use the dashboard for oversight, so Followed projects goes first,
            ahead of the org-wide Organization overview; everyone else has My tasks first since
            that's their daily driver. PMO specifically has no personal column at all — see
            hidePersonal below — so this spans full width for them. */}
        <div className={cn('space-y-4', !hidePersonal && 'lg:col-span-2')}>
          {/* Followed projects — team lead and above (see canFollowProjects/followedDefaultExpanded above) */}
          {canFollowProjects && (
            <section>
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Followed projects</h2>
                {followedExpanded && (
                  <Link to="/projects" className="ml-auto text-xs text-primary hover:underline">All projects</Link>
                )}
                <button
                  type="button"
                  onClick={toggleFollowed}
                  className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted', !followedExpanded && 'ml-auto')}
                  aria-label={followedExpanded ? 'Collapse Followed projects' : 'Expand Followed projects'}
                >
                  {followedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {followedExpanded && (
                followedLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (followedProjects?.length ?? 0) === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                      <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">No followed projects</p>
                      <p className="text-xs text-muted-foreground/70">
                        Open any project and click <strong>Follow</strong> to track it here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {followedProjects!.map((p) => (
                      <FollowedProjectCard key={p.projectId} project={p} />
                    ))}
                  </div>
                )
              )}
            </section>
          )}

          {/* Organization overview — department heads, team leads, and Executive. Scoped to the
              caller's own team/department by the same /reports/pmo endpoint that powers the full
              PMO report; PMO/Product heads and Executive get the org-wide view automatically
              since that scoping already lives server-side. */}
          {isOrgViewer && (
            <section>
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Organization</h2>
                {orgExpanded && (
                  <Link to="/reports" className="ml-auto text-xs text-primary hover:underline">Full report</Link>
                )}
                <button
                  type="button"
                  onClick={toggleOrg}
                  className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted', !orgExpanded && 'ml-auto')}
                  aria-label={orgExpanded ? 'Collapse Organization' : 'Expand Organization'}
                >
                  {orgExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {orgExpanded && (pmoLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className={STAT_GRID}>
                    <StatCard
                      title="Delivered"
                      value={pmoReport?.totalDeliveredPoints ?? 0}
                      unit="pts"
                      icon={pointsDelta < 0
                        ? <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        : <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                      iconBg={pointsDelta < 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40'}
                      sub={`${pointsDelta >= 0 ? '+' : '−'}${Math.abs(pointsDelta)} vs last week`}
                      subTone={pointsDelta > 0 ? 'good' : pointsDelta < 0 ? 'bad' : undefined}
                      to="/reports"
                    />
                    <StatCard
                      title="Cycle time"
                      value={pmoReport?.avgCycleTimeDays != null ? pmoReport.avgCycleTimeDays.toFixed(1) : '—'}
                      unit={pmoReport?.avgCycleTimeDays != null ? 'days' : undefined}
                      icon={<Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      iconBg="bg-blue-50 dark:bg-blue-950/40"
                      sub={pmoReport?.avgCycleTimeDays != null ? 'created to done' : 'Nothing completed yet'}
                      to="/reports"
                    />
                    <StatCard
                      title="PR approval"
                      value={pmoReport?.avgPrApprovalHours != null ? pmoReport.avgPrApprovalHours.toFixed(1) : '—'}
                      unit={pmoReport?.avgPrApprovalHours != null ? 'hrs' : undefined}
                      icon={<GitPullRequest className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                      iconBg="bg-violet-50 dark:bg-violet-950/40"
                      sub={pmoReport?.avgPrApprovalHours != null ? 'request to approval' : 'None approved yet'}
                      to="/reports"
                    />
                    <StatCard
                      title="At-risk projects"
                      value={atRiskProjects.length}
                      icon={<ShieldAlert className={cn('h-4 w-4', atRiskProjects.length > 0 ? 'text-red-500' : 'text-muted-foreground')} />}
                      iconBg={atRiskProjects.length > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted'}
                      sub={atRiskProjects.length > 0 ? 'Need attention' : 'All healthy'}
                      accent={atRiskProjects.length > 0 ? 'red' : undefined}
                      to="/reports"
                    />
                    <StatCard
                      title="Overworked"
                      value={overworkedCount}
                      icon={<Users className={cn('h-4 w-4', overworkedCount > 0 ? 'text-amber-500' : 'text-muted-foreground')} />}
                      iconBg={overworkedCount > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-muted'}
                      sub={overworkedCount > 0 ? 'Engineers flagged' : 'Within limits'}
                      accent={overworkedCount > 0 ? 'yellow' : undefined}
                      to="/reports"
                    />
                    <StatCard
                      title="Escalations"
                      value={orgEscalations?.length ?? 0}
                      icon={<AlertTriangle className={cn('h-4 w-4', (orgEscalations?.length ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground')} />}
                      iconBg={(orgEscalations?.length ?? 0) > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted'}
                      sub={
                        mostUrgentEscalation === null ? 'None open'
                          : mostUrgentEscalation < 0 ? `Worst: ${Math.abs(mostUrgentEscalation)}d overdue`
                          : `Next due in ${mostUrgentEscalation}d`
                      }
                      accent={(orgEscalations?.length ?? 0) > 0 ? 'red' : undefined}
                      to="/escalations"
                    />
                    <StatCard
                      title="High priority"
                      value={highPriorityCount}
                      icon={<Flame className={cn('h-4 w-4', highPriorityCount > 0 ? 'text-red-500' : 'text-muted-foreground')} />}
                      iconBg={highPriorityCount > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted'}
                      sub={highPriorityCount > 0 ? 'P4/P5 tasks open' : 'None open'}
                      accent={highPriorityCount > 0 ? 'red' : undefined}
                      to="/reports"
                    />
                  </div>

                  {/* Executive/HR get strategic, org-wide shape instead of the operational detail
                      below (blocker list, per-team check-in compliance, per-team velocity bars) —
                      those are worklists for people who act on them, not a C-level/HR concern. */}
                  {(isExecutive || isHr) && (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Card>
                          <div className="border-b border-border px-4 py-2.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio health</p>
                          </div>
                          <div className="grid grid-cols-3 divide-x divide-border">
                            <div className="px-3 py-3.5 text-center">
                              <p className="font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{portfolioHealthy}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">Healthy</p>
                            </div>
                            <div className="px-3 py-3.5 text-center">
                              <p className="font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{portfolioAtRisk}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">At Risk</p>
                            </div>
                            <div className="px-3 py-3.5 text-center">
                              <p className="font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{portfolioCritical}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">Critical</p>
                            </div>
                          </div>
                        </Card>

                        <Card>
                          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                            <span className="flex items-center gap-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery trend (6 weeks)</p>
                              <HelpTooltip
                                title="Delivery trend"
                                body="Story points marked Done each week, org-wide. A steady or rising trend is healthy; a sustained drop is worth investigating, though a single low week can just be fewer large tasks finishing that week."
                              />
                            </span>
                            {deliveryTrend.length > 0 && isCurrentWeek(deliveryTrend[deliveryTrend.length - 1].weekOf) && (
                              <p className="text-[10px] text-muted-foreground/70">latest bar in progress</p>
                            )}
                          </div>
                          <div className="h-[104px] p-3">
                            {orgTrendLoading ? (
                              <Skeleton className="h-full w-full" />
                            ) : deliveryTrend.length === 0 ? (
                              <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No delivery history yet.</p>
                            ) : (
                              <Bar
                                data={{
                                  labels: deliveryTrend.map((p) => formatDate(p.weekOf)),
                                  datasets: [{
                                    data: deliveryTrend.map((p) => p.pointsDelivered),
                                    // The last bar is lighter when it's the current, still-in-progress week —
                                    // a full-saturation bar next to a partial week's total reads as a real
                                    // drop-off that isn't there yet.
                                    backgroundColor: deliveryTrend.map((p) =>
                                      isCurrentWeek(p.weekOf) ? 'rgba(99, 102, 241, 0.4)' : 'rgb(99, 102, 241)'),
                                    borderRadius: 4,
                                  }],
                                }}
                                options={VELOCITY_CHART_OPTIONS}
                              />
                            )}
                          </div>
                        </Card>
                      </div>

                      {/* Executive only: names behind the "At-risk projects" tile and the oldest blockers, so
                          the headline numbers say which projects and tasks to ask about. Same data and
                          markup as the head/lead view below, which Executive and HR don't get. */}
                      {isExecutive && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Card>
                            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">At-risk projects</p>
                              <Link to="/projects" className="text-xs text-primary hover:underline">All projects</Link>
                            </div>
                            {pmoLoading ? (
                              <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                            ) : atRiskProjects.length === 0 ? (
                              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No at-risk projects.</p>
                            ) : (
                              <ul role="list" className="divide-y divide-border">
                                {atRiskProjects.slice(0, 5).map((p) => (
                                  <li key={p.projectId} className="px-4 py-2.5">
                                    <Link to={`/projects/${p.projectId}`} className="flex items-center justify-between gap-2 text-sm font-medium text-foreground hover:text-primary">
                                      <span className="truncate">{p.name}</span>
                                      <Badge label={HEALTH_LABEL[p.health]} variant={HEALTH_VARIANT[p.health]} />
                                    </Link>
                                    {p.activeSprintName && (
                                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.activeSprintName}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Card>

                          <Card>
                            <div className="border-b border-border px-4 py-2.5">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Longest-aging blockers</p>
                            </div>
                            {pmoLoading ? (
                              <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                            ) : topBlockers.length === 0 ? (
                              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No open blockers.</p>
                            ) : (
                              <ul role="list" className="divide-y divide-border">
                                {topBlockers.map((b) => (
                                  <li key={b.taskId} className="px-4 py-2.5">
                                    <Link to={`/tasks/${b.taskId}`} className="flex items-center justify-between gap-2 text-sm font-medium text-foreground hover:text-primary">
                                      <span className="truncate">{b.title}</span>
                                      <span className="shrink-0 font-mono text-xs tabular-nums text-red-600 dark:text-red-400">{b.daysBlocked}d</span>
                                    </Link>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                      {b.assigneeName ?? 'Unassigned'}{b.projectName && <span> · {b.projectName}</span>}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Card>
                        </div>
                      )}

                      <Card>
                        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                          <span className="flex items-center gap-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escalations fired (6 weeks)</p>
                            <HelpTooltip
                              title="Escalations fired"
                              body="Count of T-3/T-1/overdue escalation notifications sent each week, org-wide. Lower is better — a rising trend usually means more tasks are running late rather than being caught early."
                            />
                          </span>
                          {escalationTrend.length > 0 && isCurrentWeek(escalationTrend[escalationTrend.length - 1].weekOf) && (
                            <p className="text-[10px] text-muted-foreground/70">latest point in progress</p>
                          )}
                        </div>
                        <div className="h-[104px] p-3">
                          {orgTrendLoading ? (
                            <Skeleton className="h-full w-full" />
                          ) : escalationTrend.length === 0 ? (
                            <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No escalations in this window.</p>
                          ) : (
                            <Line
                              data={{
                                labels: escalationTrend.map((p) => formatDate(p.weekOf)),
                                datasets: [{
                                  data: escalationTrend.map((p) => p.count),
                                  borderColor: 'rgb(239, 68, 68)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  // Same "in progress" treatment as the bar chart, applied per-point.
                                  pointBackgroundColor: escalationTrend.map((p) =>
                                    isCurrentWeek(p.weekOf) ? 'rgba(239, 68, 68, 0.4)' : 'rgb(239, 68, 68)'),
                                  pointRadius: 3,
                                  tension: 0.3,
                                  fill: true,
                                }],
                              }}
                              options={TREND_LINE_OPTIONS}
                            />
                          )}
                        </div>
                      </Card>
                    </div>
                  )}

                  {!isExecutive && !isHr && (
                  <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card>
                      <div className="border-b border-border px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">At-risk projects</p>
                      </div>
                      {atRiskProjects.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No at-risk projects.</p>
                      ) : (
                        <ul role="list" className="divide-y divide-border">
                          {atRiskProjects.slice(0, 4).map((p) => (
                            <li key={p.projectId} className="px-4 py-2.5">
                              <Link to={`/projects/${p.projectId}`} className="flex items-center justify-between gap-2 text-sm font-medium text-foreground hover:text-primary">
                                <span className="truncate">{p.name}</span>
                                <Badge label={HEALTH_LABEL[p.health]} variant={HEALTH_VARIANT[p.health]} />
                              </Link>
                              {p.activeSprintName && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.activeSprintName}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>

                    <Card>
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active sprints</p>
                        <Link to="/sprints" className="text-xs text-primary hover:underline">All</Link>
                      </div>
                      {sprintsLoading ? (
                        <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                      ) : activeSprints.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No active sprints.</p>
                      ) : (
                        <ul role="list" className="divide-y divide-border">
                          {activeSprints.slice(0, 4).map((s) => (
                            <li key={s.id} className="px-4 py-2.5">
                              <Link to={`/sprints/${s.id}`} className="block truncate text-sm font-medium text-foreground hover:text-primary">
                                {s.name}
                              </Link>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {s.projectName && <span>{s.projectName} · </span>}
                                Ends {formatDate(s.endDate)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card>
                      <div className="border-b border-border px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Longest-aging blockers</p>
                      </div>
                      {topBlockers.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No open blockers.</p>
                      ) : (
                        <ul role="list" className="divide-y divide-border">
                          {topBlockers.map((b) => (
                            <li key={b.taskId} className="px-4 py-2.5">
                              <Link to={`/tasks/${b.taskId}`} className="flex items-center justify-between gap-2 text-sm font-medium text-foreground hover:text-primary">
                                <span className="truncate">{b.title}</span>
                                <span className="shrink-0 font-mono text-xs tabular-nums text-red-600 dark:text-red-400">{b.daysBlocked}d</span>
                              </Link>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {b.assigneeName ?? 'Unassigned'}{b.projectName && <span> · {b.projectName}</span>}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>

                    <Card>
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Check-in compliance (this week){complianceWeekInProgress && <span className="ml-1 normal-case text-muted-foreground/70">· in progress</span>}
                        </p>
                        <Link to="/standup" className="text-xs text-primary hover:underline">Standup</Link>
                      </div>
                      {standupLoading ? (
                        <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                      ) : (
                        <>
                          {missingToday > 0 && (
                            <div className="border-b border-border bg-amber-50 px-4 py-2 dark:bg-amber-950/20">
                              <p className="text-xs font-medium text-amber-800 dark:text-amber-400">{missingToday} missing today</p>
                            </div>
                          )}
                          {currentCompliance.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No compliance data yet.</p>
                          ) : (
                            <ul role="list" className="divide-y divide-border">
                              {currentCompliance.map((c) => (
                                <li key={c.teamId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                                  <span className="truncate font-medium text-foreground">{c.teamName}</span>
                                  <span className={cn(
                                    'shrink-0 font-mono text-xs font-semibold tabular-nums',
                                    c.compliancePct >= 80 ? 'text-emerald-600 dark:text-emerald-400'
                                      : c.compliancePct >= 50 ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400',
                                  )}>
                                    {c.compliancePct}% ({c.checkedInCount}/{c.engineerCount})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </Card>
                  </div>

                  {/* Sprint velocity — last 4 completed sprints per team, delivered points only.
                      One small chart per scoped team; skipped entirely if none have history yet.
                      Collapsible since it's the tallest block here and not everyone wants it open
                      by default (esp. once several teams' charts stack up). */}
                  {(pmoReport?.sprintVelocity ?? []).some((t) => t.sprints.length > 0) && (
                    <Card>
                      <button
                        type="button"
                        onClick={() => setVelocityExpanded((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-left"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sprint velocity</p>
                        {velocityExpanded
                          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      {velocityExpanded && (
                        <div className="space-y-3 p-3">
                          {pmoReport!.sprintVelocity.filter((t) => t.sprints.length > 0).map((team) => (
                            <div key={team.teamId} className="rounded-lg border border-border">
                              <div className="border-b border-border px-3 py-2">
                                <p className="text-xs font-medium text-muted-foreground">{team.teamName}</p>
                              </div>
                              <div className="h-32 p-3">
                                <Bar
                                  data={{
                                    labels: team.sprints.map((s) => s.sprintName),
                                    datasets: [{
                                      data: team.sprints.map((s) => s.deliveredPoints),
                                      backgroundColor: 'rgb(99, 102, 241)',
                                      borderRadius: 4,
                                    }],
                                  }}
                                  options={VELOCITY_CHART_OPTIONS}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}
                  </>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* My tasks — sorted by due date, 10 at a time, across every project. Hidden for PMO,
              who carries no personal task queue. */}
          {!hidePersonal && (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <CheckSquare className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">My tasks</h2>
              {myTasksExpanded && (
                <button
                  type="button"
                  onClick={() => { setShowCompletedTasks((v) => !v); myTasksCursorReset(); }}
                  className="ml-auto text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  {showCompletedTasks ? 'Hide completed' : 'Show completed'}
                </button>
              )}
              {myTasksExpanded && (
                <Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>
              )}
              <button
                type="button"
                onClick={toggleMyTasks}
                className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted', !myTasksExpanded && 'ml-auto')}
                aria-label={myTasksExpanded ? 'Collapse My tasks' : 'Expand My tasks'}
              >
                {myTasksExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {myTasksExpanded && (
            <div className="p-0">
              {myTasksLoading ? (
                <div className="space-y-0 divide-y divide-border">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-4 py-2.5"><Skeleton className="h-10 w-full" /></div>
                  ))}
                </div>
              ) : (myTasks?.items.length ?? 0) === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {showCompletedTasks ? 'No tasks yet.' : 'No active tasks.'}
                </p>
              ) : (
                <ul role="list" className="divide-y divide-border">
                  {myTasks!.items.map((task) => {
                    const days = daysLate(task);
                    const isDone = task.status === 'done';
                    return (
                      <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setPreviewTaskId(task.id)}
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
                            {!isDone && days !== null && days <= 1 && (
                              <span className="ml-1.5 font-medium text-red-600">
                                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? '· due today' : '· due tomorrow'}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">{task.points}pt</span>
                          <Badge label={task.status} variant={STATUS_VARIANT[task.status]} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!myTasksLoading && (myTasksHasPrev || myTasks?.hasMore) && (
                <div className="px-4 pb-3">
                  <Pagination
                    page={myTasksPage}
                    hasPrev={myTasksHasPrev}
                    hasMore={myTasks?.hasMore ?? false}
                    onPrev={myTasksGoPrev}
                    onNext={() => { if (myTasks?.nextCursor) myTasksGoNext(myTasks.nextCursor); }}
                  />
                </div>
              )}
            </div>
            )}
          </Card>
          )}

          {/* My projects — engineers and team leads only (PMs+ manage via the Projects page;
              Executive has no personal projects at all, same as PMO). */}
          {!isPm && !hidePersonal && (
            <section>
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">My projects</h2>
              </div>
              {myProjectsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (myProjects?.length ?? 0) === 0 ? (
                <Card>
                  <CardContent className="py-5 text-center text-sm text-muted-foreground">
                    You are not a member of any active project yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {myProjects!.map((p) => <MyProjectCard key={p.id} project={p} />)}
                </div>
              )}
            </section>
          )}

          {/* My QA queue — QA engineers only */}
          {engineer?.isQa && (
            <section>
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <FlaskConical className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">My QA queue</h2>
              </div>
              {qaQueueLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (qaQueue?.length ?? 0) === 0 ? (
                <Card>
                  <CardContent className="py-5 text-center text-sm text-muted-foreground">
                    No QA tasks awaiting your review.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {qaQueue!.map((t) => <QaQueueCard key={t.id} task={t} onOpenTask={setPreviewTaskId} />)}
                </div>
              )}
            </section>
          )}

          {/* Tasks handed off to Frontend — only shown once there's something to show, since most
              engineers never touch a two-stage task. Keeps a completed backend half visible even
              though the task's current assignee has moved on. */}
          {!myHandoffsLoading && (myHandoffs?.length ?? 0) > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-950/40">
                  <Shuffle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Handed off to Frontend</h2>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {myHandoffs!.map((t) => <HandoffCard key={t.id} task={t} onOpenTask={setPreviewTaskId} />)}
              </div>
            </section>
          )}
        </div>

        {/* Secondary column — personal stats. Hidden for PMO, who has no personal workload to
            show; every other role (including other department heads) keeps this. */}
        {!hidePersonal && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Active Tasks"
              value={activeTasks.length}
              icon={<CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              iconBg="bg-blue-50 dark:bg-blue-950/40"
              sub={`${totalPoints} pts total`}
            />
            <StatCard
              title="Workload"
              value={`${Math.round(cyclePct)}%`}
              icon={<TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
              iconBg="bg-violet-50 dark:bg-violet-950/40"
              sub={signals?.workload ? `${totalPoints} active · ${cyclePoints} due this cycle / ${baseline} pts` : `${totalPoints} / ${baseline} pts`}
              accent={signals?.isOverworked ? 'red' : cyclePct >= 100 ? 'yellow' : undefined}
            />
            <StatCard
              title="Blocked"
              value={blockedTasks.length}
              icon={<AlertTriangle className={cn('h-4 w-4', blockedTasks.length > 0 ? 'text-red-500' : 'text-muted-foreground')} />}
              iconBg={blockedTasks.length > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted'}
              sub={blockedTasks.length > 0 ? 'Need attention' : 'All clear'}
              accent={blockedTasks.length > 0 ? 'red' : undefined}
            />
            <StatCard
              title="Overwork"
              value={signalCount}
              icon={<Zap className={cn('h-4 w-4', overworked ? 'text-amber-500' : 'text-muted-foreground')} />}
              iconBg={overworked ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-muted'}
              sub={overworked ? 'Flagged' : 'Within limits'}
              accent={overworked ? 'yellow' : undefined}
            />
          </div>

          {/* My performance — velocity/quality/consistency over a rolling 30 days, the same
              personal-only metrics the standalone Performance page shows. Sits right after the
              stat tile row and before Workload capacity — this whole column is already gated
              on !hidePersonal, so no separate guard is needed here. */}
          <section>
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">My performance</h2>
              {myPerfExpanded && (
                <Link to="/performance" className="ml-auto text-xs text-primary hover:underline">Full report</Link>
              )}
              <button
                type="button"
                onClick={toggleMyPerf}
                className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted', !myPerfExpanded && 'ml-auto')}
                aria-label={myPerfExpanded ? 'Collapse My performance' : 'Expand My performance'}
              >
                {myPerfExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {myPerfExpanded && (
              myPerformanceLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !myPerformance ? (
                <Card><EmptyState size="sm" icon={Gauge} title="No performance data yet." description="Your numbers appear here once you've completed some tasks." /></Card>
              ) : (
                <MyPerformanceGrid m={myPerformance} />
              )
            )}
          </section>

          {/* Workload bar */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Workload capacity</p>
                <span className={cn(
                  'font-mono text-sm font-semibold tabular-nums',
                  overworked ? 'text-red-600' : cyclePct >= 100 ? 'text-amber-600' : 'text-foreground',
                )}>{Math.round(cyclePct)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    overworked ? 'bg-red-500' : cyclePct >= 100 ? 'bg-amber-400' : 'bg-primary',
                  )}
                  style={{ width: `${Math.min(cyclePct, 100)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground" title={dueThisCycleHelp(signals?.workload?.cycleDays)}>
                {signals?.workload
                  ? `${cyclePoints} due this cycle of ${baseline} pts · ${totalPoints} active in total`
                  : `${totalPoints} of ${baseline} pts used`}
              </p>
            </CardContent>
          </Card>

          {/* Overwork signal reasons — folded into a compact block rather than a full callout card */}
          {signals && signalCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overwork signals
              </p>
              <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400/90">
                {signals.loadVsBaseline.tripped  && <li>• {signals.loadVsBaseline.reason}</li>}
                {signals.concurrent.tripped      && <li>• {signals.concurrent.reason}</li>}
                {signals.staleInProgress.tripped && <li>• {signals.staleInProgress.reason}</li>}
              </ul>
            </div>
          )}
        </div>
        )}
      </div>

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}

function MyPerformanceGrid({ m }: { m: PerformanceMetricsDto }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        title="Velocity"
        value={`${Math.round(m.velocityRatio * 100)}%`}
        icon={<Gauge className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        iconBg="bg-blue-50 dark:bg-blue-950/40"
        sub={`${m.deliveredPoints}/${Math.round(m.expectedPoints)} pts`}
        to="/performance"
      />
      <StatCard
        title="On-time rate"
        value={formatPct(m.onTimeRate)}
        icon={<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-50 dark:bg-emerald-950/40"
        sub={`${m.tasksCompletedOnTime}/${m.tasksCompleted} tasks`}
        to="/performance"
      />
      <StatCard
        title="QA reject rate"
        value={formatPct(m.qaRejectRate)}
        icon={<TestTube2 className={cn('h-4 w-4', (m.qaRejectRate ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground')} />}
        iconBg={(m.qaRejectRate ?? 0) > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-muted'}
        sub={`${m.tasksQaRejected}/${m.tasksSentToQa} sent`}
        accent={(m.qaRejectRate ?? 0) > 0 ? 'yellow' : undefined}
        to="/performance"
      />
      <StatCard
        title="Check-ins"
        value={formatPct(m.checkInConsistency)}
        icon={<ClipboardCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
        iconBg="bg-violet-50 dark:bg-violet-950/40"
        sub={`${m.checkInCount}/${m.expectedCheckInDays} days`}
        to="/performance"
      />
    </div>
  );
}

function FollowedProjectCard({ project }: { project: FollowedProjectDto }) {
  return (
    <Card className={cn(
      'overflow-hidden border-l-4 transition-shadow hover:shadow-md',
      project.blockedTaskCount > 0 ? 'border-l-red-400' : 'border-l-primary',
    )}>
      <CardContent className="p-3.5">
        <Link
          to={`/projects/${project.projectId}`}
          className="mb-2 block truncate text-sm font-semibold text-foreground hover:text-primary"
        >
          {project.projectName}
        </Link>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {project.activeTaskCount} active
          </span>
          {project.blockedTaskCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-3 w-3" />
              {project.blockedTaskCount} blocked
            </span>
          )}
          {project.doneThisSprintCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {project.doneThisSprintCount} done this sprint
            </span>
          )}
        </div>

        {project.lastBlockerTitle && (
          <p className="mb-2 truncate text-xs text-red-600 dark:text-red-400">
            Blocker: {project.lastBlockerTitle}
          </p>
        )}

        {project.activeSprintName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">{project.activeSprintName}</span>
            {project.activeSprintEndDate && (
              <span className="shrink-0">· ends {formatDate(project.activeSprintEndDate)}</span>
            )}
          </div>
        )}

        <div className="mt-3">
          <Link
            to={`/projects/${project.projectId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View board →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function MyProjectCard({ project }: { project: MyProjectDto }) {
  return (
    <Card className={cn(
      'overflow-hidden border-l-4 transition-shadow hover:shadow-md',
      project.blockedTaskCount > 0 ? 'border-l-red-400' : 'border-l-primary',
    )}>
      <CardContent className="p-3.5">
        <Link
          to={`/projects/${project.id}`}
          className="mb-2 block truncate text-sm font-semibold text-foreground hover:text-primary"
        >
          {project.name}
        </Link>
        {project.description && (
          <p className="mb-2 truncate text-xs text-muted-foreground">{stripHtml(project.description)}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {project.activeTaskCount} active
          </span>
          {project.blockedTaskCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-3 w-3" />
              {project.blockedTaskCount} blocked
            </span>
          )}
        </div>
        <div className="mt-3">
          <Link
            to={`/projects/${project.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View board →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function QaQueueCard({ task, onOpenTask }: { task: TaskDto; onOpenTask: (taskId: string) => void }) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-primary transition-shadow hover:shadow-md">
      <CardContent className="p-3.5">
        <button
          type="button"
          onClick={() => onOpenTask(task.id)}
          className="mb-2 block w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
        >
          {task.taskKey && <span className="font-mono text-xs text-muted-foreground">{task.taskKey} </span>}
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{task.points} pts</span>
          {task.dueDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        <div className="mt-3">
          <button type="button" onClick={() => onOpenTask(task.id)} className="text-xs font-medium text-primary hover:underline">
            Review →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// A task this engineer did the backend half of, now with Frontend (or finished) — surfaced so
// finishing your part and handing off doesn't make the task disappear from your own view.
function HandoffCard({ task, onOpenTask }: { task: TaskDto; onOpenTask: (taskId: string) => void }) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-violet-400 transition-shadow hover:shadow-md">
      <CardContent className="p-3.5">
        <button
          type="button"
          onClick={() => onOpenTask(task.id)}
          className="mb-2 block w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
        >
          {task.taskKey && <span className="font-mono text-xs text-muted-foreground">{task.taskKey} </span>}
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{task.points} pts</span>
          {task.dueDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs font-medium text-violet-600 dark:text-violet-400">
          {task.status === 'done'
            ? `Done — Frontend: ${task.assigneeName ?? 'unassigned'}`
            : `With Frontend: ${task.assigneeName ?? 'unassigned'}`}
        </p>
      </CardContent>
    </Card>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
