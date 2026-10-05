import { useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useTeamVitalsList, scoreBadgeClass } from '../../api/vitals';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/layout/PageHeader';
import { FilterBar, FILTER_INPUT } from '../../components/ui/FilterBar';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import Button from '../../components/ui/Button';
import { cn } from '@/lib/utils';
import { todayIso, getWeekStart, weekLabel, parseDateOnly, toIsoDate } from '../../lib/dates';

const SCORE_LABELS: Record<number, string> = {
  1: 'Struggling', 2: 'Below par', 3: 'OK', 4: 'Good', 5: 'Great',
};

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const thisWeek = getWeekStart(todayIso());

export default function VitalsDigestPage() {
  const { currentUser } = useAuth();
  const [weekOf, setWeekOf] = useState(thisWeek);
  // The <input>'s own value — a literal echo of whatever the native picker last reported, never
  // the Monday-snapped weekOf. See the matching comment on the input below for why.
  const [pickerValue, setPickerValue] = useState(thisWeek);
  const { data: entries, isLoading } = useTeamVitalsList(weekOf);

  const pickDate = (raw: string) => {
    setPickerValue(raw);
    setWeekOf(getWeekStart(raw));
  };
  const shiftWeek = (deltaWeeks: number) => {
    const next = toIsoDate(addDays(parseDateOnly(weekOf), deltaWeeks * 7));
    setWeekOf(next);
    setPickerValue(next);
  };
  const resetToThisWeek = () => { setWeekOf(thisWeek); setPickerValue(thisWeek); };

  // Matches ListVitalsHandler's own org-wide role check — every other role that can reach this
  // page is scoped to their own department instead.
  const isOrgWide = currentUser?.role === 'hr' || currentUser?.role === 'executive'
    || currentUser?.role === 'head_of_pmo' || currentUser?.role === 'head_of_product';
  const title = isOrgWide ? 'Org vitals' : 'Team vitals';

  const respondentCount = entries?.length ?? 0;
  const avgScore = respondentCount > 0
    ? Math.round((entries!.reduce((sum, e) => sum + e.score, 0) / respondentCount) * 10) / 10
    : null;
  const lowCount = entries?.filter((e) => e.score <= 2).length ?? 0;

  return (
    <div className="max-w-2xl">
      <PageHeader title={title} description={isOrgWide ? 'Weekly vitals across the organization' : "Your team's weekly vitals"} />

      <FilterBar>
        <FilterBar.Item label="Week of">
          {/* The input's value is a literal echo of the last thing the native picker reported
              (pickerValue), NOT the Monday-snapped weekOf used for the query — feeding the picker
              back a value that differs from what was just clicked is exactly what makes
              Chrome/Safari's calendar popup flake out on the next click (see the fuller comment on
              TimeSummaryPage.tsx's identical picker). The resolved week is shown via the "Showing"
              hint instead of by rewriting the box's own value. Prev/next-week buttons sidestep the
              calendar popup entirely for the common case of stepping a week at a time. */}
          <Button size="sm" variant="ghost" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date" value={pickerValue}
            onChange={(e) => pickDate(e.target.value)}
            className={FILTER_INPUT}
          />
          <Button size="sm" variant="ghost" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOf !== thisWeek && (
            <button type="button" onClick={resetToThisWeek} className="ml-1 text-xs font-medium text-primary hover:underline">
              This week
            </button>
          )}
          <span className="ml-2 text-xs text-muted-foreground">Showing {weekLabel(weekOf)}</span>
        </FilterBar.Item>
      </FilterBar>

      {isLoading ? (
        <CardListSkeleton count={4} hasAction={false} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <Users className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-xl font-bold leading-none text-foreground">{respondentCount}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Responded</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <Activity className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-xl font-bold leading-none text-foreground">{avgScore ?? '—'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Average score</p>
              </div>
            </div>
            <div className={cn(
              'flex items-center gap-3 rounded-lg border bg-card px-4 py-3',
              lowCount > 0 ? 'border-amber-200 dark:border-amber-900/40' : 'border-border',
            )}>
              <Activity className={cn('h-5 w-5 shrink-0', lowCount > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
              <div>
                <p className={cn('text-xl font-bold leading-none', lowCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{lowCount}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Struggling or below par</p>
              </div>
            </div>
          </div>

          {entries && entries.length > 0 ? (
            <Card className="divide-y divide-border overflow-hidden p-0">
              {entries.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                    scoreBadgeClass(p.score),
                  )}>
                    {p.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p.engineerName ?? 'Unknown'}</p>
                    {p.comment && <p className="truncate text-xs text-muted-foreground">{p.comment}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{SCORE_LABELS[p.score]}</span>
                </div>
              ))}
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No responses for {weekLabel(weekOf)}.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
