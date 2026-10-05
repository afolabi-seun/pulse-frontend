import { useEffect, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, BarController, LineElement, LineController, PointElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useAuth } from '../hooks/useAuth';
import { useMyPerformance, useTeamPerformance, useProjectPerformance } from '../api/performance';
import { useEngineer, useEngineerThroughput } from '../api/engineers';
import { useTeamList, useTeamThroughput } from '../api/teams';
import { useProjectList } from '../api/projects';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Skeleton } from '../components/ui/skeleton';
import ErrorState from '../components/ui/ErrorState';
import HelpTooltip from '../components/ui/HelpTooltip';
import { Pagination } from '../components/ui/Pagination';
import { weeklyBaselinePoints } from '../lib/points';
import type { PerformanceMetricsDto, ThroughputWeekDto } from '../types/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, LineElement, LineController, PointElement, Title, Tooltip, Legend);

const CHART_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: false } },
  scales: {
    x: { grid: { display: false }, title: { display: true, text: 'Week of' } },
    y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Points delivered' } },
  },
};

// Adds a legend + baseline label — used only by charts that draw the baseline reference line,
// so the plain bar-only CHART_OPTIONS above stays legend-free where there's nothing to label.
const CHART_OPTIONS_WITH_BASELINE = {
  ...CHART_OPTIONS,
  plugins: { ...CHART_OPTIONS.plugins, legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
};

const DAY_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function DaysSelect({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <select
      value={days}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
    >
      {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function MetricTile({ label, value, sub, tooltip }: { label: string; value: string; sub?: string; tooltip?: { title: string; body: string } }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-3">
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {tooltip && <HelpTooltip title={tooltip.title} body={tooltip.body} />}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const METRIC_TOOLTIPS = {
  velocity: {
    title: 'Velocity',
    body: 'Delivered points ÷ the points the baseline expects over this window (baseline points × days in the window ÷ baseline cycle days). 100% means on pace with the baseline — well below that may mean less shipped than planned, though time off or a low baseline can also explain it.',
  },
  onTimeRate: {
    title: 'On-time rate',
    body: 'Of tasks that had a due date, the percentage completed by that date. Tasks with no due date are excluded — there’s no deadline to measure. Higher is better; 100% means every dated task shipped on time.',
  },
  qaRejectRate: {
    title: 'QA reject rate',
    body: 'Of tasks sent to QA, the percentage rejected back to the engineer. Lower is better — a high rate usually means QA is catching real issues before release, which is good for the release but may point to gaps earlier in the build.',
  },
  checkInConsistency: {
    title: 'Check-in consistency',
    body: 'Daily check-ins submitted ÷ expected weekdays in this window, capped at 100%. Higher is better — a low score usually reflects missed standups, not necessarily missed work.',
  },
  escalatedTasks: {
    title: 'Escalated tasks',
    body: 'Count of tasks that triggered an escalation (approaching or past their due date) during this window. Lower is better — 0 means nothing needed an urgent nudge.',
  },
  avgCycleTime: {
    title: 'Avg cycle time',
    body: 'Average days from task creation to completion, over tasks completed in this window. Lower generally means faster turnaround, but larger or more complex tasks naturally take longer — compare within similar work, not across very different task sizes.',
  },
  deliveredPoints: {
    title: 'Delivered points',
    body: 'Total story points completed across every member of this project in the selected window.',
  },
};

function MetricsGrid({ m }: { m: PerformanceMetricsDto }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricTile label="Velocity" value={`${Math.round(m.velocityRatio * 100)}%`} sub={`${m.deliveredPoints}/${Math.round(m.expectedPoints)} pts`} tooltip={METRIC_TOOLTIPS.velocity} />
      <MetricTile label="On-time rate" value={pct(m.onTimeRate)} sub={`${m.tasksCompletedOnTime}/${m.tasksWithDueDate} tasks`} tooltip={METRIC_TOOLTIPS.onTimeRate} />
      <MetricTile label="QA reject rate" value={pct(m.qaRejectRate)} sub={`${m.tasksQaRejected}/${m.tasksSentToQa} sent`} tooltip={METRIC_TOOLTIPS.qaRejectRate} />
      <MetricTile label="Check-in consistency" value={pct(m.checkInConsistency)} sub={`${m.checkInCount}/${m.expectedCheckInDays} days`} tooltip={METRIC_TOOLTIPS.checkInConsistency} />
      <MetricTile label="Escalated tasks" value={String(m.escalatedTaskCount)} tooltip={METRIC_TOOLTIPS.escalatedTasks} />
      <MetricTile label="Avg cycle time" value={m.avgCycleTimeDays === null ? '—' : `${m.avgCycleTimeDays.toFixed(1)}d`} tooltip={METRIC_TOOLTIPS.avgCycleTime} />
    </div>
  );
}

function WeeklyVelocityChart({ data, isLoading, weeklyBaseline }: {
  data: ThroughputWeekDto[] | undefined;
  isLoading: boolean;
  /** Points per week the baseline expects (see weeklyBaselinePoints). */
  weeklyBaseline?: number;
}) {
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No completed tasks in the last 6 weeks yet.</p>;
  }

  const labels = data.map((w) => {
    const d = new Date(w.weekOf);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  });
  const chartData = {
    labels,
    datasets: [
      { type: 'bar' as const, label: 'Delivered', data: data.map((w) => w.pointsDelivered), backgroundColor: 'rgb(99, 102, 241)', borderRadius: 4 },
      ...(weeklyBaseline
        ? [{
            type: 'line' as const,
            label: `Baseline (${Math.round(weeklyBaseline * 10) / 10} pts/week)`,
            data: data.map(() => weeklyBaseline),
            borderColor: 'rgb(220, 38, 38)',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }]
        : []),
    ],
  };

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Weekly velocity</p>
      <div className="h-40">
        <Chart type="bar" data={chartData} options={weeklyBaseline ? CHART_OPTIONS_WITH_BASELINE : CHART_OPTIONS} />
      </div>
    </div>
  );
}

function MyPerformanceSection() {
  const { currentUser } = useAuth();
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useMyPerformance(days);
  const { data: throughput, isLoading: throughputLoading } = useEngineerThroughput(currentUser!.id);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">My performance</h2>
        <DaysSelect days={days} onChange={setDays} />
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          {isLoading ? <Skeleton className="h-24 w-full" /> : error || !data ? (
            <ErrorState error={error} />
          ) : (
            <>
              <MetricsGrid m={data} />
              <WeeklyVelocityChart data={throughput} isLoading={throughputLoading} weeklyBaseline={weeklyBaselinePoints(data.baselinePoints, data.baselineCycleDays)} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

const ENGINEERS_PAGE_SIZE = 10;

// "Name · Department", unless the team's name already says it ("Core Banking Team" in Core Banking).
function teamOptionLabel(t: { name: string; department: string | null }): string {
  if (!t.department || t.name.toLowerCase().includes(t.department.toLowerCase())) return t.name;
  return `${t.name} · ${t.department}`;
}

function TeamPerformanceSection() {
  const { currentUser, allow } = useAuth();
  const canPickAnyTeam = allow('pm-or-above') || allow('executive-read') || allow('hr-read');
  const { data: engineer } = useEngineer(currentUser!.id);
  const { data: teams } = useTeamList();
  const { data: projects } = useProjectList(canPickAnyTeam);
  const [days, setDays] = useState(30);
  const [teamId, setTeamId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [pageIndex, setPageIndex] = useState(0);

  const effectiveTeamId = teamId || engineer?.teamId || '';
  const { data, isLoading, error } = useTeamPerformance(effectiveTeamId, projectId || undefined, days);
  const { data: throughput, isLoading: throughputLoading } = useTeamThroughput(effectiveTeamId);

  // Back to the first page whenever the roster changes under the reader.
  useEffect(() => { setPageIndex(0); }, [effectiveTeamId, projectId, days]);
  const total = data?.length ?? 0;
  const safePage = Math.min(pageIndex, Math.max(0, Math.ceil(total / ENGINEERS_PAGE_SIZE) - 1));
  const pageStart = safePage * ENGINEERS_PAGE_SIZE;
  const pageEngineers = (data ?? []).slice(pageStart, pageStart + ENGINEERS_PAGE_SIZE);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Team performance</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canPickAnyTeam && teams && (
            <SearchableSelect
              value={effectiveTeamId}
              onChange={setTeamId}
              placeholder="Search teams or departments…"
              emptyLabel="No matching teams or departments"
              // The department is part of the label, so typing a department name finds its teams too.
              options={teams.map((t) => ({ value: t.id, label: teamOptionLabel(t) }))}
              className="w-60"
            />
          )}
          {canPickAnyTeam && projects && (
            <SearchableSelect
              value={projectId}
              onChange={setProjectId}
              placeholder="All projects"
              emptyLabel="No matching projects"
              options={[
                { value: '', label: 'All projects' },
                ...projects.filter((p) => p.canAccess).map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="w-48"
            />
          )}
          <DaysSelect days={days} onChange={setDays} />
        </div>
      </div>
      {!effectiveTeamId ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">{canPickAnyTeam ? 'Pick a team or department to see its performance.' : 'No team to show yet.'}</CardContent></Card>
      ) : isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <ErrorState error={error} />
      ) : (data?.length ?? 0) === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No engineers on this team.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Team weekly velocity</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <WeeklyVelocityChart
                data={throughput}
                isLoading={throughputLoading}
                weeklyBaseline={data!.reduce((sum, m) => sum + weeklyBaselinePoints(m.baselinePoints, m.baselineCycleDays), 0)}
              />
            </CardContent>
          </Card>
          {pageEngineers.map((m) => (
            <Card key={m.engineerId}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{m.engineerName}</CardTitle></CardHeader>
              <CardContent className="pt-0"><MetricsGrid m={m} /></CardContent>
            </Card>
          ))}
          {total > ENGINEERS_PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {pageStart + 1}–{Math.min(pageStart + ENGINEERS_PAGE_SIZE, total)} of {total} engineers
              </p>
              <Pagination
                page={safePage + 1}
                hasPrev={safePage > 0}
                hasMore={pageStart + ENGINEERS_PAGE_SIZE < total}
                onPrev={() => setPageIndex(safePage - 1)}
                onNext={() => setPageIndex(safePage + 1)}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ProjectPerformanceSection() {
  const { data: projects } = useProjectList();
  const [projectId, setProjectId] = useState<string>('');
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useProjectPerformance(projectId, days);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Project performance</h2>
        <div className="flex flex-wrap items-center gap-2">
          {projects && (
            <SearchableSelect
              value={projectId}
              onChange={setProjectId}
              placeholder="Select a project…"
              emptyLabel="No matching projects"
              options={projects.filter((p) => p.canAccess).map((p) => ({ value: p.id, label: p.name }))}
              className="w-48"
            />
          )}
          <DaysSelect days={days} onChange={setDays} />
        </div>
      </div>
      {!projectId ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Pick a project to see its performance.</CardContent></Card>
      ) : isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error || !data ? (
        <ErrorState error={error} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-xs text-muted-foreground">{data.engineerCount} engineer(s) on this project</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricTile label="Delivered points" value={String(data.deliveredPoints)} tooltip={METRIC_TOOLTIPS.deliveredPoints} />
              <MetricTile label="On-time rate" value={pct(data.onTimeRate)} sub={`${data.tasksCompletedOnTime}/${data.tasksWithDueDate} tasks`} tooltip={METRIC_TOOLTIPS.onTimeRate} />
              <MetricTile label="QA reject rate" value={pct(data.qaRejectRate)} sub={`${data.tasksQaRejected}/${data.tasksSentToQa} sent`} tooltip={METRIC_TOOLTIPS.qaRejectRate} />
              <MetricTile label="Escalated tasks" value={String(data.escalatedTaskCount)} tooltip={METRIC_TOOLTIPS.escalatedTasks} />
              <MetricTile label="Avg cycle time" value={data.avgCycleTimeDays === null ? '—' : `${data.avgCycleTimeDays.toFixed(1)}d`} tooltip={METRIC_TOOLTIPS.avgCycleTime} />
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default function PerformancePage() {
  const { allow } = useAuth();

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Performance" description="Velocity, delivery, quality, and consistency over a rolling window." />
      <MyPerformanceSection />
      {(allow('team-lead-or-above') || allow('executive-read') || allow('hr-read')) && <TeamPerformanceSection />}
      {(allow('pm-or-above') || allow('executive-read') || allow('hr-read')) && <ProjectPerformanceSection />}
    </div>
  );
}
