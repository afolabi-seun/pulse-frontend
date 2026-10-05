import { useState, useEffect } from 'react';
import { AlertTriangle, BarChart2, ShieldAlert, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useLeadershipReport } from '../../api/reports';
import client from '../../api/client';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import ErrorState from '../../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '../../components/ui/Pagination';
import { EngineerUtilizationTable } from '../../components/reports/EngineerUtilizationTable';
import { cn } from '@/lib/utils';
import { formatDate, weekLabel, isCurrentWeek } from '../../lib/dates';

async function downloadPdf(weekOf?: string) {
  const response = await client.get('/reports/leadership/pdf', {
    params: weekOf ? { weekOf } : undefined,
    responseType: 'blob',
    transformResponse: [(data) => data],
  });
  const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = weekOf ? `leadership-report-${weekOf}.pdf` : 'leadership-report.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeadershipReportPage() {
  const [weekOf, setWeekOf]           = useState('');
  const [downloading, setDownloading] = useState(false);
  const [capacityPage, setCapacityPage] = useState(1);
  const [escalationPage, setEscalationPage] = useState(1);
  const [blockerPage, setBlockerPage] = useState(1);
  const { data: report, isLoading, error, refetch } = useLeadershipReport(weekOf || undefined);

  const CAPACITY_PAGE_SIZE = 10;
  const ESCALATION_PAGE_SIZE = 10;
  const BLOCKER_PAGE_SIZE = 10;
  useEffect(() => {
    setCapacityPage(1);
    setEscalationPage(1);
    setBlockerPage(1);
  }, [report?.weekOf]);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Leadership report"
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)}
              className="h-9 w-36"
            />
            <Button
              variant="secondary" size="sm" loading={downloading}
              onClick={async () => {
                setDownloading(true);
                try { await downloadPdf(weekOf || undefined); }
                finally { setDownloading(false); }
              }}
            >
              Download PDF
            </Button>
          </div>
        }
      />

      {isLoading && <DashboardSkeleton />}
      {error     && <ErrorState error={error} onRetry={refetch} />}

      {report && (() => {
        const hasEscalations = report.escalations.length > 0;
        const hasBlockers    = report.blockers.length > 0;
        const delta          = report.totalDeliveredPoints - report.previousWeekPoints;
        const pct            = report.previousWeekPoints > 0
          ? Math.round((delta / report.previousWeekPoints) * 100)
          : null;
        const up             = delta >= 0;
        const weekInProgress = isCurrentWeek(report.weekOf);

        return (
          <div className="space-y-4 print:space-y-8">

            {/* ── Summary stat cards ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <BarChart2 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-3xl font-bold text-foreground">{report.totalDeliveredPoints}</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Points delivered{report.isCallerDepartmentScoped && ' (org-wide)'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">{weekLabel(report.weekOf)}</p>
                </CardContent>
              </Card>

              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <BarChart2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-bold text-muted-foreground">{report.previousWeekPoints}</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Points delivered{report.isCallerDepartmentScoped && ' (org-wide)'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">Previous week</p>
                </CardContent>
              </Card>

              {pct !== null && (
                <Card className={cn('transition-shadow hover:shadow-md', up ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-red-200 dark:border-red-900/40')}>
                  <CardContent className="p-4">
                    <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-xl', up ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40')}>
                      {up
                        ? <TrendingUp  className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        : <TrendingDown className="h-5 w-5 text-red-500" />
                      }
                    </div>
                    <p className={cn('text-3xl font-bold', up ? 'text-emerald-600' : 'text-destructive')}>
                      {up ? '+' : ''}{pct}%
                    </p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Week-on-week{report.isCallerDepartmentScoped && ' (org-wide)'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {weekInProgress ? 'vs last week — this week is still in progress' : 'vs last week'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Alerts: at-risk tasks + active blockers ── */}
            {(hasEscalations || hasBlockers) && (
              <div className={cn('grid grid-cols-1 gap-4', hasEscalations && hasBlockers && 'lg:grid-cols-2')}>

                {hasEscalations && (() => {
                  const totalEscalationPages = Math.ceil(report.escalations.length / ESCALATION_PAGE_SIZE);
                  const pagedEscalations = report.escalations.slice(
                    (escalationPage - 1) * ESCALATION_PAGE_SIZE,
                    escalationPage * ESCALATION_PAGE_SIZE,
                  );
                  return (
                  <section>
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-foreground">At-risk tasks</h2>
                    </div>
                    <Card>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Assignee</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Level</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedEscalations.map((esc) => (
                            <TableRow key={esc.taskId}>
                              <TableCell className="text-foreground">
                                {esc.taskKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{esc.taskKey}</span>}
                                {esc.title}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{esc.projectName ?? '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{esc.assigneeName ?? '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(esc.dueDate)}</TableCell>
                              <TableCell>
                                <Badge
                                  label={esc.level === 'Overdue' ? 'overdue' : esc.level === 'TMinus1' ? 'T-1' : 'T-3'}
                                  variant={esc.level === 'Overdue' ? 'red' : esc.level === 'TMinus1' ? 'red' : 'yellow'}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </Card>
                    <Pagination
                      hasPrev={escalationPage > 1}
                      hasMore={escalationPage < totalEscalationPages}
                      onPrev={() => setEscalationPage((p) => p - 1)}
                      onNext={() => setEscalationPage((p) => p + 1)}
                      page={escalationPage}
                    />
                  </section>
                  );
                })()}

                {hasBlockers && (() => {
                  const totalBlockerPages = Math.ceil(report.blockers.length / BLOCKER_PAGE_SIZE);
                  const pagedBlockers = report.blockers.slice(
                    (blockerPage - 1) * BLOCKER_PAGE_SIZE,
                    blockerPage * BLOCKER_PAGE_SIZE,
                  );
                  return (
                  <section>
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 dark:bg-red-950/40">
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                      </div>
                      <h2 className="text-sm font-semibold text-foreground">Active blockers</h2>
                    </div>
                    <Card>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Blocked</TableHead>
                            <TableHead>Days</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedBlockers.map((b) => (
                            <TableRow key={b.taskId}>
                              <TableCell className="text-foreground">
                                {b.taskKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{b.taskKey}</span>}
                                {b.title}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{b.projectName ?? '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{b.assigneeName ?? '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{b.daysBlocked}d</TableCell>
                              <TableCell className="text-red-600 dark:text-red-400">{b.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </Card>
                    <Pagination
                      hasPrev={blockerPage > 1}
                      hasMore={blockerPage < totalBlockerPages}
                      onPrev={() => setBlockerPage((p) => p - 1)}
                      onNext={() => setBlockerPage((p) => p + 1)}
                      page={blockerPage}
                    />
                  </section>
                  );
                })()}
              </div>
            )}

            {/* ── Team capacity ── */}
            {(() => {
              const totalCapacityPages = Math.ceil(report.engineers.length / CAPACITY_PAGE_SIZE);
              const pagedEngineers = report.engineers.slice(
                (capacityPage - 1) * CAPACITY_PAGE_SIZE,
                capacityPage * CAPACITY_PAGE_SIZE,
              );
              return (
                <section>
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Team capacity</h2>
                  </div>
                  <Card>
                    <EngineerUtilizationTable engineers={pagedEngineers} periodLabel={weekLabel(report.weekOf)} />
                  </Card>
                  <Pagination
                    hasPrev={capacityPage > 1}
                    hasMore={capacityPage < totalCapacityPages}
                    onPrev={() => setCapacityPage((p) => p - 1)}
                    onNext={() => setCapacityPage((p) => p + 1)}
                    page={capacityPage}
                  />
                </section>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}
