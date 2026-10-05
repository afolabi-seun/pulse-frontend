import { Fragment, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  BarChart2, CheckCircle2, ClipboardList, ShieldAlert, TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import { useWeeklyReport, useSaveWeeklyReportDraft, useSubmitWeeklyReport } from '../../api/weeklyReports';
import { downloadWeeklyReportDocx } from '../../api/reports';
import { useTeamList } from '../../api/teams';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { applyServerErrors } from '../../lib/formErrors';
import { EngineerUtilizationTable } from '../../components/reports/EngineerUtilizationTable';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDateTime, weekLabel, isCurrentWeek } from '../../lib/dates';
import HelpTooltip from '../../components/ui/HelpTooltip';
import ProjectHealthDetail, { HealthLegend, HealthToggle, healthSummary } from '../../components/reports/ProjectHealthDetail';

function healthBadge(health: 'Healthy' | 'AtRisk' | 'Critical') {
  if (health === 'Critical') return <Badge label="Critical" variant="red" />;
  if (health === 'AtRisk') return <Badge label="At Risk" variant="yellow" />;
  return <Badge label="Healthy" variant="green" />;
}

function blockerDaysColor(days: number) {
  if (days > 7) return 'text-red-600 dark:text-red-400 font-semibold';
  if (days >= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">{icon}</div>
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
    </div>
  );
}

interface FormValues {
  executiveSummary: string;
  keyAccomplishments: string;
  plannedNextWeek: string;
  resourcingNotes: string;
}

export default function WeeklyReportPage() {
  const { isTeamLead } = useCurrentRole();
  const { allow } = useAuth();
  const canEdit = allow('team-lead-or-head-only');
  const [openHealthId, setOpenHealthId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState('');
  const [weekOf, setWeekOf] = useState('');
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  // Only the team picker reads this, and a team lead (who has no picker) isn't allowed to list teams.
  const { data: teams } = useTeamList(!isTeamLead);

  const effectiveTeamId = isTeamLead ? undefined : (teamId || undefined);
  const canQuery = isTeamLead || !!teamId;

  const { data: report, isLoading, error, refetch } = useWeeklyReport(effectiveTeamId, weekOf || undefined, canQuery);
  const saveDraft = useSaveWeeklyReportDraft();
  const submitReport = useSubmitWeeklyReport();

  const { register, handleSubmit, reset, setError, getValues, setValue, formState: { errors, isDirty } } = useForm<FormValues>();

  useEffect(() => {
    if (report) {
      reset({
        executiveSummary: report.executiveSummary,
        keyAccomplishments: report.keyAccomplishments,
        plannedNextWeek: report.plannedNextWeek,
        resourcingNotes: report.resourcingNotes,
      });
    }
  }, [report, reset]);

  const onSaveDraft = handleSubmit((values) => {
    if (!report) return;
    saveDraft.mutate(
      { teamId: report.teamId, weekOf: report.weekOf, ...values },
      {
        onSuccess: () => toast.success('Draft saved.'),
        onError: (e) => applyServerErrors(e, setError),
      },
    );
  });

  const onSubmitReport = handleSubmit((values) => {
    if (!report) return;
    saveDraft.mutate(
      { teamId: report.teamId, weekOf: report.weekOf, ...values },
      {
        onSuccess: (saved) => {
          submitReport.mutate(
            { teamId: saved.teamId, weekOf: saved.weekOf },
            {
              onSuccess: () => toast.success('Weekly report submitted.'),
              onError: (e) => applyServerErrors(e, setError),
            },
          );
        },
        onError: (e) => applyServerErrors(e, setError),
      },
    );
  });

  const onSuggestDraft = () => {
    if (!report) return;
    const suggestions: Record<keyof FormValues, string> = {
      executiveSummary: report.suggestedExecutiveSummary,
      keyAccomplishments: report.suggestedKeyAccomplishments,
      plannedNextWeek: report.suggestedPlannedNextWeek,
      resourcingNotes: report.suggestedResourcingNotes,
    };
    (Object.keys(suggestions) as (keyof FormValues)[]).forEach((field) => {
      if (!getValues(field)?.trim()) {
        setValue(field, suggestions[field], { shouldDirty: true });
      }
    });
  };

  const saving = saveDraft.isPending || submitReport.isPending;
  const [downloading, setDownloading] = useState(false);

  const handleDownloadDocx = async () => {
    if (!report) return;
    setDownloading(true);
    try { await downloadWeeklyReportDocx(report.teamId, report.weekOf); }
    finally { setDownloading(false); }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Weekly report"
        actions={
          <div className="flex items-center gap-2">
            {!isTeamLead && (
              <SearchableSelect
                className="w-52 [&_input]:h-9 [&_input]:text-sm"
                value={teamId}
                onChange={setTeamId}
                placeholder="Select a team…"
                emptyLabel="No matching teams"
                options={(teams ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            <Input
              type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)}
              className="h-9 w-36"
            />
            <Button variant="secondary" size="sm" loading={downloading} disabled={!report} onClick={handleDownloadDocx}>
              Download .docx
            </Button>
          </div>
        }
      />

      {!canQuery && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Select a team to view its weekly report.</CardContent></Card>
      )}

      {canQuery && isLoading && <DashboardSkeleton />}
      {canQuery && error && <ErrorState error={error} onRetry={refetch} />}

      {canQuery && report && (() => {
        const delta = report.totalDeliveredPoints - report.previousWeekPoints;
        const pct = report.previousWeekPoints > 0
          ? Math.round((delta / report.previousWeekPoints) * 100)
          : null;
        const up = delta >= 0;
        const latestCompliance = report.compliance.weeks[report.compliance.weeks.length - 1];
        const weekInProgress = isCurrentWeek(report.weekOf);

        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{report.teamName}</h2>
                <p className="text-xs text-muted-foreground">{weekLabel(report.weekOf)}</p>
              </div>
              {report.submittedAt ? (
                <Badge label={`Submitted by ${report.submittedByName ?? 'unknown'} · ${formatDateTime(report.submittedAt)}`} variant="green" />
              ) : (
                <Badge label="Draft" variant="gray" />
              )}
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <BarChart2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground">{report.totalDeliveredPoints}</p>
                    <p className="truncate text-xs text-muted-foreground">Points delivered</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', up ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40')}>
                    {up ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-2xl font-bold', up ? 'text-emerald-600' : 'text-destructive')}>
                      {pct !== null ? `${up ? '+' : ''}${pct}%` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{weekInProgress ? 'vs. last week — in progress' : 'vs. last week'}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground">
                      {report.utilization.avgLoadPct === null ? 'N/A' : `${report.utilization.avgLoadPct}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.utilization.avgLoadPct === null ? 'Avg team load — no one on this team' : 'Avg team load'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground">{latestCompliance ? `${latestCompliance.compliancePct}%` : '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {latestCompliance && weekInProgress ? 'Check-in compliance — in progress' : 'Check-in compliance'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workstream / Deliverable Status */}
            <section>
              <SectionHeader icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />} label="Workstream / Deliverable Status" />
              <HealthLegend />
              <Card>
                <div className="overflow-x-auto">
                  <Table className="[&_td]:py-2 [&_th]:py-2 [&_th]:text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Workstream</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Active</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Blocked</TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          <span className="inline-flex items-center justify-end gap-1">Completion
                            <HelpTooltip title="Completion" body="Tasks done ÷ all tasks, all time. For a project another team owns, it covers only this team's tasks on it." />
                          </span>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          <span className="inline-flex items-center justify-end gap-1">Check-ins
                            <HelpTooltip title="Check-ins" body="Engineers who checked in on this project this week ÷ engineers working on it. A dash means nobody is currently assigned to it." />
                          </span>
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">Status
                            <HelpTooltip title="Status" body="Healthy, At Risk or Critical — click a status for the reasons and what to do. Critical means something has been late or blocked for too long, or several tasks are late." />
                          </span>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          <span className="inline-flex items-center justify-end gap-1">Hours
                            <HelpTooltip title="Hours" body="Time this team's engineers logged on the project this week." />
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.workstreams.map((w) => {
                        const coverage = report.checkInCoverage.find((c) => c.projectId === w.projectId);
                        return (
                          <Fragment key={w.projectId}>
                          <TableRow>
                            <TableCell className="max-w-[160px] font-medium text-foreground">
                              <span className="block truncate" title={w.name}>{w.name}</span>
                              {w.teamSliceOnly && (
                                <span className="block text-[11px] font-normal text-muted-foreground">this team's tasks only</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">{w.activeTasks}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">{w.blockedTasks}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">{w.completionPct}%</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                              {coverage && coverage.expectedEngineers > 0
                                ? `${coverage.checkedInEngineers}/${coverage.expectedEngineers}`
                                : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <HealthToggle
                                project={w}
                                open={openHealthId === w.projectId}
                                onToggle={() => setOpenHealthId((cur) => (cur === w.projectId ? null : w.projectId))}
                                badge={healthBadge(w.health)}
                              />
                              {w.reasons && w.reasons.length > 0 && (
                                <p className="mt-0.5 max-w-[14rem] whitespace-normal text-[11px] leading-tight text-muted-foreground">{healthSummary(w)}</p>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">{w.hoursLoggedThisWeek}h</TableCell>
                          </TableRow>
                          {openHealthId === w.projectId && (
                            <TableRow>
                              <TableCell colSpan={7} className="p-0 whitespace-normal"><ProjectHealthDetail project={w} /></TableCell>
                            </TableRow>
                          )}
                          </Fragment>
                        );
                      })}
                      {report.workstreams.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No projects owned by this team.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </section>

            {/* Team Utilization */}
            <section>
              <SectionHeader icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />} label="Team Utilization" />
              <Card>
                <EngineerUtilizationTable
                  engineers={report.utilization.engineers}
                  periodLabel={weekLabel(report.weekOf)}
                  emptyLabel="No delivery engineers on this team."
                />
              </Card>
            </section>

            {/* Risks, Blockers & Support Needed */}
            <section>
              <SectionHeader icon={<ShieldAlert className="h-3.5 w-3.5 text-red-500" />} label="Risks, Blockers & Support Needed" />
              <Card className="overflow-hidden p-0">
                {report.blockers.length === 0 ? (
                  <p className="px-4 py-3 text-center text-sm text-muted-foreground">No active blockers.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {report.blockers.map((b) => (
                      <div
                        key={b.taskId}
                        className="cursor-pointer px-4 py-3 transition-colors hover:bg-muted/30"
                        onClick={() => setPreviewTaskId(b.taskId)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <p className="min-w-0 truncate text-sm font-medium text-foreground hover:text-primary" title={b.title}>
                            {b.taskKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{b.taskKey}</span>}
                            {b.title}
                          </p>
                          <span className={cn('shrink-0 text-xs font-medium', blockerDaysColor(b.daysBlocked))}>{b.daysBlocked}d</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{b.projectName ?? '—'} · {b.assigneeName ?? 'Unassigned'}</p>
                        {b.reason && <p className="mt-1 truncate text-xs text-muted-foreground" title={b.reason}>{b.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>

            {/* Narrative sections */}
            <section>
              <SectionHeader icon={<ClipboardList className="h-3.5 w-3.5 text-primary" />} label="Team Lead Summary" />
              <Card className="overflow-hidden">
                <form onSubmit={onSaveDraft}>
                  {[
                    { name: 'executiveSummary' as const, label: 'Executive summary', placeholder: 'Brief overview of the week’s progress and anything requiring leadership attention.' },
                    { name: 'keyAccomplishments' as const, label: 'Key accomplishments this week', placeholder: 'What shipped, what got fixed, what got unblocked.' },
                    { name: 'plannedNextWeek' as const, label: 'Planned for next week', placeholder: 'What the team plans to focus on next.' },
                    { name: 'resourcingNotes' as const, label: 'Team & resourcing notes', placeholder: 'Headcount changes, leave, hiring needs, capacity concerns.' },
                  ].map((field, i) => (
                    <div key={field.name} className={cn('px-5 py-4', i > 0 && 'border-t border-border')}>
                      <p className="mb-1.5 text-sm font-semibold text-foreground">{field.label}</p>
                      {canEdit ? (
                        <>
                          <Textarea rows={3} {...register(field.name)} placeholder={field.placeholder} />
                          {errors[field.name] && <p className="mt-1.5 text-xs text-destructive">{errors[field.name]?.message}</p>}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {report[field.name] || '—'}
                        </p>
                      )}
                    </div>
                  ))}

                  {canEdit && (
                    <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
                      <Button type="button" variant="secondary" onClick={onSuggestDraft} className="w-full whitespace-nowrap sm:w-auto">Suggest draft</Button>
                      <Button type="submit" variant="secondary" loading={saveDraft.isPending} className="w-full whitespace-nowrap sm:w-auto">Save draft</Button>
                      <Button type="button" loading={submitReport.isPending} disabled={saving} onClick={onSubmitReport} className="w-full whitespace-nowrap sm:w-auto">
                        Submit weekly report
                      </Button>
                      {isDirty && <span className="text-xs text-muted-foreground sm:ml-1">Unsaved changes</span>}
                    </div>
                  )}
                </form>
              </Card>
            </section>
          </div>
        );
      })()}
      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}
