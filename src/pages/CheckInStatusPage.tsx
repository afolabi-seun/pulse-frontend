import { useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { useCheckInStatus } from '../api/checkIns';
import { useEngineerList } from '../api/engineers';
import { useTeamList } from '../api/teams';
import { useAuth } from '../hooks/useAuth';
import { useCurrentRole } from '../hooks/useCurrentRole';

import PageHeader from '../components/layout/PageHeader';
import { FilterBar, FILTER_INPUT } from '../components/ui/FilterBar';
import Badge from '../components/ui/Badge';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import ErrorState from '../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { todayIso } from '../lib/dates';

const ROSTER_CAP = 25;

// Roles that can never submit a daily check-in in the first place (see CapabilityRegistry's
// CheckInExpected on the backend) — excluded from the roster entirely rather than just no longer
// falsely flagged as "missing", matching how Time Summary excludes non-time-loggers outright.
const CHECK_IN_EXEMPT_ROLES = new Set(['executive', 'hr', 'head_of_pmo', 'project_manager', 'accountant']);


export default function CheckInStatusPage() {
  const todayIsoValue = todayIso();
  const [date, setDate] = useState(todayIsoValue);
  const [showAll, setShowAll] = useState(false);
  const { currentUser } = useAuth();
  const { isPmo, isHeadOfProduct } = useCurrentRole();

  const { data: status, isLoading: loadingStatus, error, refetch } = useCheckInStatus(date);
  const { data: engineers, isLoading: loadingEng } = useEngineerList();
  const { data: teams } = useTeamList();

  const isLoading = loadingStatus || loadingEng;

  if (isLoading) return <TablePageSkeleton cols={3} hasAction={false} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const myEngineer    = engineers?.find((e) => e.id === currentUser?.id);
  const myTeam        = teams?.find((t) => t.id === myEngineer?.teamId);
  const myDept        = myTeam?.department ?? null;
  const teamDeptMap   = new Map(teams?.map((t) => [t.id, t.department]) ?? []);
  const hasDeptData   = teams?.some((t) => t.department !== null) ?? false;

  // PMO (Head of PMO or Project Manager) and Head of Product get org-wide reach here too — same
  // convention as everywhere else check-in visibility is scoped (CheckInVisibility,
  // GetCheckInStatusQuery, GetStandupSummaryQuery) — so they aren't narrowed to their own
  // department just because they happen to be assigned to a team.
  const seesOrgWide   = isPmo || isHeadOfProduct;
  const allActive     = engineers?.filter((e) => e.isActive && !CHECK_IN_EXEMPT_ROLES.has(e.role)) ?? [];
  const filteredActive = (seesOrgWide || !myDept || !hasDeptData)
    ? allActive
    : allActive.filter((e) => e.teamId !== null && teamDeptMap.get(e.teamId ?? '') === myDept);
  const activeEngineers = filteredActive.length > 0 ? filteredActive : allActive;

  const missingSet    = new Set(status?.missingEngineers ?? []);
  const checkedIn     = activeEngineers.filter((e) => !missingSet.has(e.id));
  const notCheckedIn  = activeEngineers.filter((e) =>  missingSet.has(e.id));
  const displayDate     = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-lg">
      <PageHeader title="Check-in status" description={displayDate} />

      <FilterBar>
        <FilterBar.Item label="Date">
          <input type="date" value={date} max={todayIsoValue} onChange={(e) => setDate(e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{checkedIn.length}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Checked in</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-amber-500">{notCheckedIn.length}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Not yet</p>
          </CardContent>
        </Card>
      </div>

      <Card className="divide-y divide-border overflow-hidden p-0">
        {(showAll ? activeEngineers : activeEngineers.slice(0, ROSTER_CAP)).map((eng) => {
          const done = !missingSet.has(eng.id);
          const initials = eng.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
          return (
            <div key={eng.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
              )}>
                {initials}
              </div>
              <span className="flex-1 text-sm font-medium text-foreground">{eng.name}</span>
              <Badge label={done ? 'Checked in' : 'Pending'} variant={done ? 'green' : 'yellow'} />
            </div>
          );
        })}
        {!showAll && activeEngineers.length > ROSTER_CAP && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full px-4 py-2.5 text-center text-xs font-medium text-primary hover:underline"
          >
            Show all {activeEngineers.length}
          </button>
        )}
      </Card>
    </div>
  );
}
