import { Fragment, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { usePmoReport, downloadPmoCsv, downloadLeadershipPdf } from '../../api/reports';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import ErrorState from '../../components/ui/ErrorState';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { EngineerUtilizationTable } from '../../components/reports/EngineerUtilizationTable';
import { FilterBar, FILTER_INPUT } from '../../components/ui/FilterBar';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { weekLabel, isCurrentWeek, formatDate } from '../../lib/dates';
import ProjectHealthDetail, { HealthLegend, HealthToggle, healthSummary } from '../../components/reports/ProjectHealthDetail';

const TEAM_PREVIEW = 5;

function complianceColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function blockerDaysColor(days: number) {
  if (days > 7) return 'text-red-600 dark:text-red-400 font-semibold';
  if (days >= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function healthBadge(health: 'Healthy' | 'AtRisk' | 'Critical') {
  if (health === 'Critical') return <Badge label="Critical" variant="red" />;
  if (health === 'AtRisk') return <Badge label="At Risk" variant="yellow" />;
  return <Badge label="Healthy" variant="green" />;
}

function SectionHeader({ icon, label, badge }: { icon: React.ReactNode; label: string; badge?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {badge}
    </div>
  );
}

export default function ReportsPage() {
  const [openHealthId, setOpenHealthId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  const toggleTeam = (id: string) =>
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { data: report, isLoading, error, refetch } = usePmoReport(dateFrom || undefined, dateTo || undefined);
  // Points delivered and every Hours column follow this custom range once one is set; Team
  // Utilization's non-hours figures and Check-in Compliance's 4-week table stay anchored to the
  // calendar week instead (see PmoReportDto.DeliveredFrom's own doc comment) — surfaced here so
  // that split is visible instead of silently implied by a single "week of" label.
  const isCustomRange = !!(dateFrom || dateTo);

  const handleDownloadCsv = async () => {
    setDownloading(true);
    try { await downloadPmoCsv(dateFrom || undefined, dateTo || undefined); } finally { setDownloading(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try { await downloadLeadershipPdf(); } finally { setDownloadingPdf(false); }
  };

  return (
    <div className="max-w-6xl">
      <PageHeader title="Reports" />

      <FilterBar hasFilters={!!(dateFrom || dateTo)} onClear={() => { setDateFrom(''); setDateTo(''); }}>
        <FilterBar.Item label="From">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="To">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
        <div className="ml-auto flex items-center gap-1">
          <FilterBar.Divider />
          <button
            type="button"
            disabled={downloadingPdf}
            onClick={handleDownloadPdf}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Clock className="h-3 w-3" />
            {downloadingPdf ? 'Loading…' : 'Leadership PDF'}
          </button>
          <FilterBar.Divider />
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadCsv}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {downloading ? 'Loading…' : 'Download CSV'}
          </button>
        </div>
      </FilterBar>

      {isLoading && <DashboardSkeleton />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {report && (
        <div className="space-y-5">

          {/* Summary stat strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{report.totalDeliveredPoints}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Points delivered · {isCustomRange
                      ? `${formatDate(report.deliveredFrom)} – ${formatDate(report.deliveredTo)}`
                      : weekLabel(report.weekOf)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-muted-foreground">{report.previousWeekPoints}</p>
                  <p className="text-xs text-muted-foreground">Points delivered · {isCustomRange ? 'previous equivalent range' : 'previous week'}</p>
                </div>
              </CardContent>
            </Card>

            {(() => {
              const delta = report.totalDeliveredPoints - report.previousWeekPoints;
              const pct = report.previousWeekPoints > 0
                ? Math.round((delta / report.previousWeekPoints) * 100)
                : null;
              const up = delta >= 0;
              const inProgress = isCurrentWeek(report.weekOf);
              return pct !== null ? (
                <Card className={cn('transition-shadow hover:shadow-sm', up ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-red-200 dark:border-red-900/40')}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', up ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40')}>
                      {up
                        ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        : <TrendingDown className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-2xl font-bold', up ? 'text-emerald-600' : 'text-destructive')}>
                        {up ? '+' : ''}{pct}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Week-on-week vs last week{inProgress && ' — this week is still in progress'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()}
          </div>

          {/* Section 1 — Team Utilization */}
          <section>
            <SectionHeader
              icon={<Users className="h-3.5 w-3.5 text-primary" />}
              label="Team Utilization"
              badge={isCustomRange && (
                <span className="text-xs font-normal text-muted-foreground">
                  — Hours and Completed reflect your date filter; other figures reflect the calendar week of {weekLabel(report.weekOf)}
                </span>
              )}
            />
            {report.teams.length === 0 ? (
              <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">No teams found.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {report.teams.map((team) => (
                  <div key={team.teamId}>
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{team.teamName}</p>
                      {team.overworkedCount > 0 && <Badge label={`${team.overworkedCount} overworked`} variant="red" />}
                      <span className="ml-auto text-xs text-muted-foreground">
                        Avg load: {team.avgLoadPct === null ? 'N/A (no one on this team)' : `${team.avgLoadPct}%`}
                      </span>
                    </div>
                    <Card>
                        <EngineerUtilizationTable
                          engineers={expandedTeams.has(team.teamId) ? team.engineers : team.engineers.slice(0, TEAM_PREVIEW)}
                          showRole
                          periodLabel={`${formatDate(report.deliveredFrom)} – ${formatDate(report.deliveredTo)}`}
                        />
                      {team.engineers.length > TEAM_PREVIEW && (
                        <button
                          type="button"
                          onClick={() => toggleTeam(team.teamId)}
                          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                        >
                          {expandedTeams.has(team.teamId) ? (
                            <><ChevronUp className="h-3.5 w-3.5" /> Show fewer</>
                          ) : (
                            <><ChevronDown className="h-3.5 w-3.5" /> Show {team.engineers.length - TEAM_PREVIEW} more</>
                          )}
                        </button>
                      )}
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2 — Project Health */}
          <section>
            <SectionHeader icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />} label="Project Health" />
            <HealthLegend />
            <Card>
                <Table className="[&_td]:py-2 [&_th]:py-2 [&_th]:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">Blocked</TableHead>
                      <TableHead className="text-right">Done This Sprint</TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center justify-end gap-1">Completion
                          <HelpTooltip title="Completion" body="Tasks done ÷ all tasks on the project, all time." />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center justify-end gap-1">Escalations
                          <HelpTooltip title="Escalations" body="Tasks that are overdue or due within the escalation window (3 days by default)." />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">High priority</TableHead>
                      <TableHead>Sprint</TableHead>
                      <TableHead>
                        <span className="inline-flex items-center gap-1">Health
                          <HelpTooltip title="Health" body="Click a status for the reasons and what to do. Critical means something has been late or blocked for too long, or several tasks are late." />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center justify-end gap-1">Hours
                          <HelpTooltip title="Hours" body="Time logged on the project in the period shown." />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.projects.map((p) => (
                      <Fragment key={p.projectId}>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.totalTasks}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.activeTasks}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.blockedTasks}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.doneThisSprint}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            'tabular-nums',
                            p.completionPct >= 80 ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : p.completionPct >= 50 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                          )}>
                            {p.completionPct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.escalationCount}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            'tabular-nums',
                            p.highPriorityOpenTasks > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground',
                          )}>
                            {p.highPriorityOpenTasks}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.activeSprintName ?? '—'}</TableCell>
                        <TableCell>
                          <HealthToggle
                            project={p}
                            open={openHealthId === p.projectId}
                            onToggle={() => setOpenHealthId((cur) => (cur === p.projectId ? null : p.projectId))}
                            badge={healthBadge(p.health)}
                          />
                          {p.reasons && p.reasons.length > 0 && (
                            <p className="mt-0.5 max-w-[16rem] text-[11px] leading-tight text-muted-foreground">{healthSummary(p)}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.hoursLoggedThisWeek}h</TableCell>
                      </TableRow>
                      {openHealthId === p.projectId && (
                        <TableRow>
                          <TableCell colSpan={11} className="p-0"><ProjectHealthDetail project={p} /></TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    ))}
                    {report.projects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground">No active projects.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            </Card>
          </section>

          {/* Section 3 — Sprint Delivery Rate */}
          <section>
            <SectionHeader icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} label="Sprint Delivery Rate" />
            {report.sprintVelocity.length === 0 ? (
              <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">No completed sprints.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {report.sprintVelocity.map((team) => (
                  <div key={team.teamId}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{team.teamName}</p>
                    <Card>
                        <Table className="[&_td]:py-2 [&_th]:py-2 [&_th]:text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Sprint</TableHead>
                              <TableHead className="text-right">Planned</TableHead>
                              <TableHead className="text-right">Delivered</TableHead>
                              <TableHead className="text-right">
                                <span className="inline-flex items-center justify-end gap-1">
                                  Rate %
                                  <HelpTooltip
                                    title="Rate %"
                                    body="Delivered points ÷ planned points for the sprint. Close to or above 100% means the sprint delivered what was planned; well below suggests over-committing or mid-sprint scope loss."
                                  />
                                </span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {team.sprints.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">No completed sprints.</TableCell>
                              </TableRow>
                            ) : (
                              team.sprints.map((sprint) => {
                                const rate = sprint.plannedPoints && sprint.plannedPoints > 0
                                  ? Math.round((sprint.deliveredPoints / sprint.plannedPoints) * 100)
                                  : null;
                                return (
                                  <TableRow key={sprint.sprintName}>
                                    <TableCell className="font-medium text-foreground">{sprint.sprintName}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{sprint.plannedPoints ?? '—'}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{sprint.deliveredPoints}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{rate !== null ? `${rate}%` : '—'}</TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 4 — Check-in Compliance */}
          <section>
            <SectionHeader
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
              label="Check-in Compliance"
              badge={isCustomRange && (
                <span className="text-xs font-normal text-muted-foreground">— always the last 4 calendar weeks, not your date filter</span>
              )}
            />
            {report.checkInCompliance.length === 0 ? (
              <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">No compliance data available.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {report.checkInCompliance.map((team) => (
                  <div key={team.teamId}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{team.teamName}</p>
                    <Card>
                        <Table className="[&_td]:py-2 [&_th]:py-2 [&_th]:text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Week</TableHead>
                              <TableHead className="text-right">Engineers</TableHead>
                              <TableHead className="text-right">Checked In</TableHead>
                              <TableHead>
                                <span className="inline-flex items-center gap-1">
                                  Compliance
                                  <HelpTooltip
                                    title="Compliance"
                                    body="Checked-in engineers ÷ engineers expected to check in that week. 80% and above is healthy, 50–79% needs a nudge, and below 50% is a real gap."
                                  />
                                </span>
                              </TableHead>
                              <TableHead className="text-right">Trend</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {team.weeks.map((week, i) => {
                              const prev = team.weeks[i - 1];
                              const delta = prev != null ? week.compliancePct - prev.compliancePct : null;
                              return (
                                <TableRow key={week.weekOf}>
                                  <TableCell className="text-muted-foreground">
                                    {weekLabel(week.weekOf)}
                                    {isCurrentWeek(week.weekOf) && (
                                      <span className="ml-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">in progress</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">{week.engineerCount}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{week.checkedInCount}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                        <div
                                          className={cn('h-full rounded-full transition-all', {
                                            'bg-emerald-500': week.compliancePct >= 80,
                                            'bg-amber-500':   week.compliancePct >= 50 && week.compliancePct < 80,
                                            'bg-red-500':     week.compliancePct < 50,
                                          })}
                                          style={{ width: `${week.compliancePct}%` }}
                                        />
                                      </div>
                                      <span className={cn('text-xs tabular-nums', complianceColor(week.compliancePct))}>
                                        {week.compliancePct}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {delta == null ? (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    ) : delta > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                        <TrendingUp className="h-3 w-3" />+{delta}pp
                                      </span>
                                    ) : delta < 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                                        <TrendingDown className="h-3 w-3" />{delta}pp
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">→ flat</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 5 — Active Blockers */}
          {report.blockerAging.length > 0 && (
            <section>
              <SectionHeader
                icon={<ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                label="Active Blockers"
                badge={<Badge label={`${report.blockerAging.length}`} variant="red" />}
              />
              <Card>
                <div className="overflow-x-auto">
                  <Table className="[&_td]:py-2 [&_th]:py-2 [&_th]:text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Title</TableHead>
                        <TableHead className="whitespace-nowrap">Assignee</TableHead>
                        <TableHead className="whitespace-nowrap">Project</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Days Blocked</TableHead>
                        <TableHead className="whitespace-nowrap">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.blockerAging.map((b) => (
                        <TableRow key={b.taskId} className="cursor-pointer" onClick={() => setPreviewTaskId(b.taskId)}>
                          <TableCell className="max-w-[180px] truncate font-medium text-foreground hover:text-primary" title={b.title}>
                            {b.taskKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{b.taskKey}</span>}
                            {b.title}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{b.assigneeName ?? 'Unassigned'}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{b.projectName ?? '—'}</TableCell>
                          <TableCell className={cn('whitespace-nowrap text-right', blockerDaysColor(b.daysBlocked))}>
                            {b.daysBlocked}d
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-muted-foreground" title={b.reason ?? undefined}>{b.reason ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </section>
          )}

        </div>
      )}
      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}
