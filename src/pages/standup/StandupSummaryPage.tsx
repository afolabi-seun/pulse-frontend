import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSessionState } from '../../hooks/useSessionState';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  CheckSquare, Download, Users, X,
} from 'lucide-react';
import { FilterBar, FILTER_INPUT } from '../../components/ui/FilterBar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useStandupSummary, useCheckInHistory, downloadStandupSummaryCsv } from '../../api/checkIns';
import { useTeamList } from '../../api/teams';
import { useTaskList } from '../../api/tasks';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { useEngineer } from '../../api/engineers';
import { formatPtsDays } from '../../lib/points';
import { todayIso } from '../../lib/dates';
import PageHeader from '../../components/layout/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Card, CardContent } from '@/components/ui/card';
import ExpandableText from '../../components/checkins/ExpandableText';
import { cn } from '@/lib/utils';
import type { MissingEngineerDto, StandupEntryDto } from '../../types/api';

function today(): string {
  return todayIso();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function roleLabel(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusDot(status: string) {
  if (status === 'done') return 'bg-emerald-500';
  if (status === 'blocked') return 'bg-red-500';
  if (status === 'paused') return 'bg-yellow-500';
  return 'bg-blue-400';
}

// ── Missing engineer drawer ───────────────────────────────────────────────────

function MissingDrawer({ engineer, onClose }: { engineer: MissingEngineerDto; onClose: () => void }) {
  const { data: history, isLoading: loadingHistory } = useCheckInHistory(engineer.id);
  const { data: tasks, isLoading: loadingTasks } = useTaskList({ assigneeId: engineer.id, limit: 20 });
  const { data: engineerDetail } = useEngineer(engineer.id);

  const recentCheckIns = history?.items?.slice(0, 5) ?? [];
  const activeTasks = (tasks?.items ?? []).filter((t) => t.status !== 'done');

  // Rendered in a portal so "fixed" always means the screen, whatever the page around it is doing.
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold text-foreground">{engineer.name}</p>
            <p className="text-xs font-medium text-amber-600">No check-in today</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recent check-ins</h3>
            </div>
            {loadingHistory && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loadingHistory && recentCheckIns.length === 0 && (
              <p className="text-sm text-muted-foreground">No check-ins on record.</p>
            )}
            <div className="space-y-3">
              {recentCheckIns.map((ci) => (
                <div key={ci.id} className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(ci.date)}</p>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">Completed</p>
                    <p className="text-sm text-foreground">{ci.completed}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">Planned next</p>
                    <p className="text-sm text-foreground">{ci.plannedNext}</p>
                  </div>
                  {ci.blockers && (
                    <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-900/40 dark:bg-red-950/20">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-red-600 mb-0.5">Blocker</p>
                      <p className="text-sm text-red-700 dark:text-red-400">{ci.blockers}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Active tasks</h3>
            </div>
            {loadingTasks && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loadingTasks && activeTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No active tasks.</p>
            )}
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', statusDot(task.status))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {task.points}pts
                        {(() => { const d = formatPtsDays(task.points, engineerDetail); return d ? ` · ${d}` : ''; })()}
                      </span>
                      {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
                      {task.status === 'blocked' && (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <AlertTriangle className="h-3 w-3" /> Blocked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Digest cards ──────────────────────────────────────────────────────────────

/** Check-ins shown per page. A team that straddles a page break carries on under its header on the next page. */
const PAGE_SIZE = 25;

/** One team's check-ins, a card per engineer (and project) — blockers called out inline. */
function EntriesTable({ entries }: { entries: StandupEntryDto[] }) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <Card key={`${entry.engineerId}-${entry.projectId ?? 'none'}`} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <p className="text-sm font-semibold leading-snug text-foreground">{entry.engineerName}</p>
              <span className="text-[11px] text-muted-foreground">{roleLabel(entry.role)}</span>
              {entry.projectName && (
                <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                  {entry.projectName}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
                <div className="mt-0.5 text-sm text-foreground"><ExpandableText text={entry.completed} lines={2} /></div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Planned next</p>
                <div className="mt-0.5 text-sm text-foreground"><ExpandableText text={entry.plannedNext} lines={2} /></div>
              </div>
            </div>
            {entry.blockers && (
              <div className="mt-3 flex items-start gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <ExpandableText text={entry.blockers} lines={2} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A compact stat for the strip under the filters. */
function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone?: 'amber' | 'red' }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className={cn('text-lg font-bold leading-none', tone === 'red' && value > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StandupSummaryPage() {
  const [date, setDate]         = useState(today());
  const [teamId, setTeamId]     = useState('');
  const [selected, setSelected] = useState<MissingEngineerDto | null>(null);
  const [onlyBlockers, setOnlyBlockers] = useState(false);
  // Teams the reader has folded away (kept while browsing).
  const [collapsedTeams, setCollapsedTeams] = useSessionState<string[]>('standup.collapsed', []);
  const [pageIndex, setPageIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const { currentUser } = useAuth();
  const { isPmo, isHeadOfProduct, isTeamLead } = useCurrentRole();

  const { data: teams }              = useTeamList();
  const { data: summary, isLoading } = useStandupSummary(teamId || undefined, date);
  const { data: myEngineerData }     = useEngineer(currentUser?.id ?? '');

  const myTeam = teams?.find((t) => t.id === myEngineerData?.teamId);
  const myDept = myTeam?.department ?? null;

  // PMO (head_of_pmo or project_manager) and head_of_product see all teams — matches the
  // backend, which already returns org-wide data for all three by default; everyone else is
  // scoped to their dept or team.
  const visibleTeams = isPmo || isHeadOfProduct
    ? teams
    : isTeamLead
      ? undefined
      : myDept
        ? teams?.filter((t) => t.department === myDept)
        : teams;

  const entries  = summary?.entries ?? [];
  const missing  = summary?.missingEngineers ?? [];

  // Stats
  const blockerCount       = useMemo(() => entries.filter((e) => !!e.blockers).length, [entries]);
  const checkedInEngineers = useMemo(() => new Set(entries.map((e) => e.engineerId)).size, [entries]);

  // Group entries by team — preserve order, ungrouped entries go under "No team". "Only blockers" narrows them.
  const groupedEntries = useMemo(() => {
    const map = new Map<string, StandupEntryDto[]>();
    for (const e of entries) {
      if (onlyBlockers && !e.blockers) continue;
      const key = e.teamName ?? 'No team';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [entries, onlyBlockers]);

  const showTeamHeaders = groupedEntries.length > 1;
  const allFolded = groupedEntries.length > 0 && groupedEntries.every(([name]) => collapsedTeams.includes(name));
  const isFolded = (name: string) => showTeamHeaders && collapsedTeams.includes(name);

  // Pages run across teams, over the rows of teams that aren't folded away.
  const pageable = groupedEntries.flatMap(([team, teamEntries]) => (isFolded(team) ? [] : teamEntries.map((e) => ({ team, e }))));
  const pageCount = Math.max(1, Math.ceil(pageable.length / PAGE_SIZE));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const onPage = pageable.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const rowsByTeam = new Map<string, StandupEntryDto[]>();
  onPage.forEach(({ team, e }) => rowsByTeam.set(team, [...(rowsByTeam.get(team) ?? []), e]));
  // A blocker on another page is the one thing paging must not hide.
  const blockersOnOtherPages = pageable.length - onPage.length > 0
    ? pageable.filter(({ e }) => !!e.blockers).length - onPage.filter(({ e }) => !!e.blockers).length
    : 0;

  const handleDownloadCsv = async () => {
    setDownloading(true);
    try {
      await downloadStandupSummaryCsv(teamId || undefined, date);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <PageHeader title="Standup digest" />

      <FilterBar>
        <FilterBar.Item label="Date">
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPageIndex(0); }} className={FILTER_INPUT} />
        </FilterBar.Item>
        {!isTeamLead && visibleTeams && visibleTeams.length > 1 && (
          <>
            <FilterBar.Divider />
            <FilterBar.Item label="Team">
              <SearchableSelect
                className="w-40 [&_input]:h-8 [&_input]:text-xs"
                value={teamId}
                onChange={(v) => { setTeamId(v); setPageIndex(0); }}
                placeholder="All teams"
                emptyLabel="No matching teams"
                options={[{ value: '', label: 'All' }, ...visibleTeams.map((t) => ({ value: t.id, label: t.name }))]}
              />
            </FilterBar.Item>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
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

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {summary && (
        <>
          {entries.length === 0 && missing.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No check-ins submitted for this date.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">

              {/* Compact stat strip; the blockers count doubles as a filter */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5">
                <Stat icon={<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />} value={checkedInEngineers} label="checked in" />
                <Stat icon={<AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />} value={missing.length} label="missing" />
                <Stat
                  icon={<AlertTriangle className={cn('h-4 w-4 shrink-0', blockerCount > 0 ? 'text-red-500' : 'text-muted-foreground')} />}
                  value={blockerCount} label={blockerCount === 1 ? 'blocker' : 'blockers'} tone="red"
                />
                {blockerCount > 0 && (
                  <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                      checked={onlyBlockers}
                      onChange={(e) => { setOnlyBlockers(e.target.checked); setPageIndex(0); }}
                    />
                    Show only blockers
                  </label>
                )}
              </div>

              {/* Check-ins, a table per team; a team folds, and still says how many blockers it is hiding */}
              {showTeamHeaders && groupedEntries.length > 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setCollapsedTeams(allFolded ? [] : groupedEntries.map(([name]) => name))}
                  >
                    {allFolded ? 'Unfold all' : 'Fold all'}
                  </button>
                </div>
              )}
              {blockersOnOtherPages > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{blockersOnOtherPages} blocker{blockersOnOtherPages === 1 ? '' : 's'} on other pages.</span>
                  <button
                    type="button"
                    className="ml-auto font-medium underline"
                    onClick={() => { setOnlyBlockers(true); setPageIndex(0); }}
                  >
                    Show only blockers
                  </button>
                </div>
              )}
              {groupedEntries.map(([teamName, teamEntries]) => {
                const folded = isFolded(teamName);
                const rows = rowsByTeam.get(teamName) ?? [];
                // A team with nothing on this page and not folded has no business here.
                if (!folded && rows.length === 0) return null;
                const teamBlockers = teamEntries.filter((e) => !!e.blockers).length;
                return (
                  <section key={teamName}>
                    {showTeamHeaders && (
                      <button
                        type="button"
                        aria-expanded={!folded}
                        aria-label={`${teamName}, ${teamEntries.length} check-in${teamEntries.length === 1 ? '' : 's'}`}
                        onClick={() => { setCollapsedTeams((c) => (c.includes(teamName) ? c.filter((n) => n !== teamName) : [...c, teamName])); setPageIndex(0); }}
                        className="mb-2 flex w-full items-center gap-2 text-left"
                      >
                        {folded ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">{teamName}</h2>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {teamEntries.length}
                        </span>
                        {teamBlockers > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3" /> {teamBlockers} blocker{teamBlockers === 1 ? '' : 's'}
                          </span>
                        )}
                      </button>
                    )}
                    {!folded && <EntriesTable entries={rows} />}
                  </section>
                );
              })}

              {pageable.length > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing {safePage * PAGE_SIZE + 1}–{safePage * PAGE_SIZE + onPage.length} of {pageable.length} check-ins
                  </p>
                  <Pagination
                    page={safePage + 1}
                    hasPrev={safePage > 0}
                    hasMore={safePage + 1 < pageCount}
                    onPrev={() => setPageIndex(safePage - 1)}
                    onNext={() => setPageIndex(safePage + 1)}
                  />
                </div>
              )}

              {/* Missing */}
              {missing.length > 0 && !onlyBlockers && (
                <Card className="overflow-hidden border-amber-200 dark:border-amber-900/40">
                  <div className="flex items-center gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                      Missing ({missing.length})
                    </p>
                    <p className="ml-auto text-xs text-amber-600 dark:text-amber-400">Click to view details</p>
                  </div>
                  <CardContent className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {missing.map((eng) => (
                        <button
                          key={eng.id}
                          onClick={() => setSelected(eng)}
                          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 transition-colors hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{eng.name}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <MissingDrawer engineer={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
