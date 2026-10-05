import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart2, CheckSquare, Users, UserCheck } from 'lucide-react';
import { useEngineerListPage } from '../../api/engineers';
import { useTeamList } from '../../api/teams';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { FilterBar, FILTER_SELECT } from '../../components/ui/FilterBar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Pagination } from '../../components/ui/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WorkloadFigures } from '../../components/workload/WorkloadFigures';
import type { EngineerDto } from '../../types/api';

// ── Workload bar ──────────────────────────────────────────────────────────────

/** The bar shows the load the overwork signal judges (what is due this cycle) against the baseline, and goes red when
 * that signal says overworked — so it can never disagree with the badge above it. */
function WorkloadBar({ points, baselinePoints, over }: { points: number; baselinePoints: number; over: boolean }) {
  const pct = baselinePoints > 0 ? Math.min((points / baselinePoints) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', over ? 'bg-red-500' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Engineer card ─────────────────────────────────────────────────────────────

function EngineerCard({ engineer }: { engineer: EngineerDto }) {
  const navigate = useNavigate();
  const initials = engineer.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md cursor-pointer',
        !engineer.isActive && 'opacity-70',
      )}
      onClick={() => navigate(`/engineers/${engineer.id}`)}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
          <div className="flex items-center gap-1.5">
            {engineer.isOverworked && (
              <Badge label="overworked" variant="red" />
            )}
            <Badge
              label={engineer.isActive ? 'active' : 'inactive'}
              variant={engineer.isActive ? 'green' : 'gray'}
            />
          </div>
        </div>

        <Link
          to={`/engineers/${engineer.id}`}
          className="font-semibold text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          onClick={(e) => e.stopPropagation()}
        >
          {engineer.name}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">{engineer.email}</p>
        <p className="mt-1.5 text-sm text-muted-foreground capitalize">
          {engineer.role.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="border-t border-border px-5 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{engineer.activeTasks} task{engineer.activeTasks !== 1 ? 's' : ''}</span>
          <WorkloadFigures
            activePoints={engineer.totalPoints}
            cyclePoints={engineer.cyclePoints}
            baselinePoints={engineer.baselinePoints}
            cycleDays={engineer.baselineCycleDays}
            overworked={engineer.isOverworked}
          />
        </div>
        <WorkloadBar
          points={engineer.cyclePoints ?? engineer.totalPoints}
          baselinePoints={engineer.baselinePoints}
          over={engineer.isOverworked}
        />
      </div>
    </Card>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, iconCls, value, label, hint }: {
  icon: React.ElementType; iconBg: string; iconCls: string;
  value: string | number; label: string;
  /** Said on hover — what the number is measured on. */
  hint?: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md" title={hint}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconBg)}>
          <Icon className={cn('h-5 w-5', iconCls)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EngineersPage() {
  const [filters, setFilter, , clearFilters] = useUrlFilters({ team: '', status: '' }, ['cursor', 'cursorPage']);
  const { team, status } = filters;

  const { isHeadOfPmo: showTeamFilter } = useCurrentRole();
  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination();

  const { data, isLoading, error, refetch } = useEngineerListPage({
    cursor: cursor || undefined,
    teamId: team || undefined,
    isActive: status ? status === 'active' : undefined,
  });
  const { data: teams } = useTeamList();
  const hasFilters = !!(team || status);

  const setTeamFilter   = (value: string) => setFilter('team', value);
  const setStatusFilter = (value: string) => setFilter('status', value);
  const clearAllFilters = () => clearFilters();

  if (isLoading) return <CardListSkeleton count={9} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const items    = data?.items ?? [];
  const active   = items.filter((e) => e.isActive);
  const inactive = items.filter((e) => !e.isActive);
  const stats    = data!.stats;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Engineers" description="Workload at a glance" />

      {/* Stats — always the full department/org roster, independent of the grid's own filters */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={UserCheck}      iconBg="bg-primary/10"                           iconCls="text-primary"                         value={stats.activeCount} label="Active engineers" />
        <StatCard icon={AlertTriangle}  iconBg={stats.overworkedCount > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted'} iconCls={stats.overworkedCount > 0 ? 'text-red-500' : 'text-muted-foreground'} value={stats.overworkedCount}       label="Overworked" />
        <StatCard icon={BarChart2}      iconBg="bg-violet-50 dark:bg-violet-950/40"      iconCls="text-violet-600 dark:text-violet-400" value={`${stats.avgUtilisation}%`}    label="Avg utilisation" hint="Points due this cycle ÷ baseline, averaged over active engineers" />
        <StatCard icon={CheckSquare}    iconBg="bg-emerald-50 dark:bg-emerald-950/40"    iconCls="text-emerald-600 dark:text-emerald-400" value={stats.tasksInFlight}     label="Tasks in flight" />
      </div>

      {/* Filters */}
      <FilterBar hasFilters={hasFilters} onClear={clearAllFilters}>
        {showTeamFilter && (
          <>
            <FilterBar.Item label="Team">
              <SearchableSelect
                className="w-40 [&_input]:h-8 [&_input]:text-xs"
                value={team}
                onChange={setTeamFilter}
                placeholder="All teams"
                emptyLabel="No matching teams"
                options={[{ value: '', label: 'All teams' }, ...(teams ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))]}
              />
            </FilterBar.Item>
            <FilterBar.Divider />
          </>
        )}
        <FilterBar.Item label="Status">
          <select value={status} onChange={(e) => setStatusFilter(e.target.value)} className={FILTER_SELECT}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterBar.Item>
      </FilterBar>

      {/* Grid */}
      {active.length === 0 && inactive.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No engineers match your filters' : 'No engineers yet'}
            description={hasFilters ? 'Try adjusting or clearing your filters.' : 'Engineers appear here once they have activated their account.'}
            action={hasFilters ? <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">Clear filters</button> : undefined}
          />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((eng) => <EngineerCard key={eng.id} engineer={eng} />)}
            </div>
          )}

          {inactive.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">Inactive</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((eng) => <EngineerCard key={eng.id} engineer={eng} />)}
              </div>
            </div>
          )}

          <div className="mt-6">
            <Pagination
              hasPrev={hasPrev}
              hasMore={data?.hasMore ?? false}
              onPrev={goPrev}
              onNext={() => data?.nextCursor && goNext(data.nextCursor)}
              page={pageNumber}
            />
          </div>
        </>
      )}
    </div>
  );
}
