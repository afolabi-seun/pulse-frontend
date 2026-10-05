import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Clock, Download, Folder, Users } from 'lucide-react';
import { useTimeEntrySummary, useTimeEntrySummaryRange, downloadTimeSummaryCsv } from '../api/timeEntries';
import PageHeader from '../components/layout/PageHeader';
import { FilterBar, FILTER_INPUT } from '../components/ui/FilterBar';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import ErrorState from '../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollFadeX } from '@/components/ui/scroll-fade';
import Button from '../components/ui/Button';
import EngineerTimeDetail from '../components/time/EngineerTimeDetail';
import ProjectTimeDetail from '../components/time/ProjectTimeDetail';
import { cn } from '@/lib/utils';
import { getWeekStart, parseDateOnly, toIsoDate } from '../lib/dates';
import type { EngineerHoursDto } from '../types/api';

const ROSTER_CAP = 25;
const MAX_RANGE_DAYS = 62; // matches the backend's own cap
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatLong(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function daysBetween(fromIso: string, toIso: string): Date[] {
  const from = parseDateOnly(fromIso);
  const to = parseDateOnly(toIso);
  const count = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

function hoursOn(eng: EngineerHoursDto, dateIso: string): number {
  return eng.dailyHours.find((d) => d.date === dateIso)?.hours ?? 0;
}

const thisWeek = getWeekStart(toIsoDate(new Date()));
const thisWeekEnd = toIsoDate(addDays(parseDateOnly(thisWeek), 6));

export default function TimeSummaryPage() {
  const [view, setView] = useState<'week' | 'day'>('week');

  // ── Week total: Monday-Sunday, navigated by week ──────────────────────────
  const [weekOf, setWeekOf] = useState(thisWeek);
  // The <input>'s own value — kept as a literal echo of whatever the native picker last reported,
  // never a derived/snapped value. Feeding the input a value that differs from what was just
  // clicked (e.g. Monday-snapping a Thursday pick) is what makes Chrome/Safari's calendar popup
  // flake out on the very next click — see the comment on the input below.
  const [weekPickerValue, setWeekPickerValue] = useState(thisWeek);
  const pickWeekDate = (raw: string) => { setWeekPickerValue(raw); setWeekOf(getWeekStart(raw)); };
  const shiftWeek = (deltaWeeks: number) => {
    const next = toIsoDate(addDays(parseDateOnly(weekOf), deltaWeeks * 7));
    setWeekOf(next);
    setWeekPickerValue(next);
  };
  const resetToThisWeek = () => { setWeekOf(thisWeek); setWeekPickerValue(thisWeek); };

  // ── By day: an arbitrary, unsnapped date range ────────────────────────────
  const [dayFrom, setDayFrom] = useState(thisWeek);
  const [dayTo, setDayTo] = useState(thisWeekEnd);
  const rangeInvalid = parseDateOnly(dayTo).getTime() < parseDateOnly(dayFrom).getTime();
  const rangeTooLong = !rangeInvalid && daysBetween(dayFrom, dayTo).length > MAX_RANGE_DAYS;
  const rangeQueryEnabled = view === 'day' && !rangeInvalid && !rangeTooLong;

  const [downloading, setDownloading] = useState(false);
  const handleDownloadCsv = async () => {
    setDownloading(true);
    try {
      await downloadTimeSummaryCsv(view === 'week' ? { weekOf } : { from: dayFrom, to: dayTo });
    } finally {
      setDownloading(false);
    }
  };

  const [showAll, setShowAll] = useState(false);
  // One engineer's detail open at a time — what they logged, by task, in the window shown.
  const [openEngineerId, setOpenEngineerId] = useState<string | null>(null);
  const toggleEngineer = (id: string) => setOpenEngineerId((cur) => (cur === id ? null : id));
  // And one project line's breakdown: who logged the hours behind it, and on what. Keyed by kind + id because the
  // "General" and "Personal tasks" lines both have no project id.
  const [openProjectKey, setOpenProjectKey] = useState<string | null>(null);

  const weekQuery = useTimeEntrySummary(weekOf, view === 'week');
  const rangeQuery = useTimeEntrySummaryRange(dayFrom, dayTo, rangeQueryEnabled);
  const { data, isLoading, error, refetch } = view === 'week' ? weekQuery : rangeQuery;

  const days = useMemo(() => (data ? daysBetween(data.weekOf, data.to) : []), [data]);

  if (view === 'day' && (rangeInvalid || rangeTooLong)) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Time summary" description="By day" />
        <RangeControls
          view={view} setView={setView}
          weekPickerValue={weekPickerValue} pickWeekDate={pickWeekDate} shiftWeek={shiftWeek}
          weekOf={weekOf} resetToThisWeek={resetToThisWeek}
          dayFrom={dayFrom} setDayFrom={setDayFrom} dayTo={dayTo} setDayTo={setDayTo}
        />
        <p className="mt-3 text-sm text-destructive">
          {rangeInvalid ? '"To" must be on or after "From".' : `Pick a range of ${MAX_RANGE_DAYS} days or fewer.`}
        </p>
      </div>
    );
  }
  if (isLoading) return <TablePageSkeleton cols={2} hasAction={false} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const engineers = data?.engineers ?? [];
  const projects = data?.projects ?? [];
  const zeroHours = engineers.filter((e) => e.totalHours === 0);
  const displayRange = data ? `${formatLong(data.weekOf)} – ${formatLong(data.to)}` : '';
  const dayTotal = (dateIso: string) => engineers.reduce((sum, e) => sum + hoursOn(e, dateIso), 0);
  const shownEngineers = showAll ? engineers : engineers.slice(0, ROSTER_CAP);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Time summary" description={displayRange} />

      <RangeControls
        view={view} setView={setView}
        weekPickerValue={weekPickerValue} pickWeekDate={pickWeekDate} shiftWeek={shiftWeek}
        weekOf={weekOf} resetToThisWeek={resetToThisWeek}
        dayFrom={dayFrom} setDayFrom={setDayFrom} dayTo={dayTo} setDayTo={setDayTo}
        displayRange={displayRange}
        onDownloadCsv={handleDownloadCsv} downloading={downloading}
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{data?.teamTotalHours ?? 0}h</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Total hours logged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
              <Users className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-amber-500">{zeroHours.length}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Engineers with zero hours</p>
          </CardContent>
        </Card>
      </div>

      {view === 'week' ? (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {shownEngineers.map((eng) => {
            const initials = eng.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
            const open = openEngineerId === eng.engineerId;
            return (
              <div key={eng.engineerId}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`${eng.name} — ${open ? 'hide' : 'show'} what they logged`}
                  onClick={() => toggleEngineer(eng.engineerId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {initials}
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{eng.name}</span>
                  <span className="text-sm font-semibold text-foreground">{eng.totalHours}h</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </button>
                {open && data && <EngineerTimeDetail engineerId={eng.engineerId} from={data.weekOf} to={data.to} />}
              </div>
            );
          })}
          {!showAll && engineers.length > ROSTER_CAP && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full px-4 py-2.5 text-center text-xs font-medium text-primary hover:underline"
            >
              Show all {engineers.length}
            </button>
          )}
        </Card>
      ) : (
        <ScrollFadeX>
          <Card className="max-h-[70vh] overflow-auto p-0">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 w-40 border border-border bg-card px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                    Engineer
                  </th>
                  {days.map((d) => {
                    const dateIso = toIsoDate(d);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th key={dateIso} className={cn(
                        'sticky top-0 z-10 w-14 border border-border bg-card px-1 py-1.5 text-center font-semibold text-muted-foreground',
                        weekend && 'bg-muted/40',
                      )}>
                        {DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                        <div className="font-normal">{d.getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="sticky top-0 z-10 w-16 border border-border bg-card px-2 py-1.5 text-center font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {shownEngineers.map((eng) => (
                  <Fragment key={eng.engineerId}>
                  <tr>
                    <td className="border border-border px-2.5 py-1.5 font-medium text-foreground">
                      <button
                        type="button"
                        aria-expanded={openEngineerId === eng.engineerId}
                        aria-label={`${eng.name} — ${openEngineerId === eng.engineerId ? 'hide' : 'show'} what they logged`}
                        onClick={() => toggleEngineer(eng.engineerId)}
                        className="flex items-center gap-1 text-left hover:text-primary"
                      >
                        {eng.name}
                        <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', openEngineerId === eng.engineerId && 'rotate-180')} />
                      </button>
                    </td>
                    {days.map((d) => {
                      const dateIso = toIsoDate(d);
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const hours = hoursOn(eng, dateIso);
                      return (
                        <td key={dateIso} className={cn(
                          'border border-border px-1 py-1.5 text-center text-foreground',
                          weekend && 'bg-muted/10',
                          hours === 0 && 'text-muted-foreground',
                        )}>
                          {hours === 0 ? '–' : `${hours}h`}
                        </td>
                      );
                    })}
                    <td className="border border-border px-2 py-1.5 text-center font-semibold text-foreground">{eng.totalHours}h</td>
                  </tr>
                  {openEngineerId === eng.engineerId && data && (
                    <tr>
                      <td colSpan={days.length + 2} className="border border-border p-0">
                        <EngineerTimeDetail engineerId={eng.engineerId} from={data.weekOf} to={data.to} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {!showAll && engineers.length > ROSTER_CAP && (
                  <tr>
                    <td colSpan={days.length + 2} className="border border-border px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Show all {engineers.length}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td className="border border-border bg-muted/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</td>
                  {days.map((d) => {
                    const dateIso = toIsoDate(d);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <td key={dateIso} className={cn('border border-border bg-muted/30 px-2 py-1.5 text-center font-semibold text-foreground', weekend && 'bg-muted/50')}>
                        {dayTotal(dateIso)}h
                      </td>
                    );
                  })}
                  <td className="border border-border bg-muted/30 px-2 py-1.5 text-center font-bold text-foreground">{data?.teamTotalHours ?? 0}h</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </ScrollFadeX>
      )}

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours by project</h2>
      <Card className="divide-y divide-border overflow-hidden p-0">
        {projects.map((p) => {
          const key = `${p.kind ?? 'project'}:${p.projectId ?? ''}`;
          const open = openProjectKey === key;
          return (
            <div key={key}>
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${p.projectName} — ${open ? 'hide' : 'show'} who logged these hours`}
                onClick={() => setOpenProjectKey((cur) => (cur === key ? null : key))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Folder className="h-3.5 w-3.5" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{p.projectName}</span>
                <span className="text-sm font-semibold text-foreground">{p.totalHours}h</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
              </button>
              {open && data && <ProjectTimeDetail project={p} from={data.weekOf} to={data.to} />}
            </div>
          );
        })}
        {projects.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No hours logged in this window.</p>
        )}
      </Card>
    </div>
  );
}

interface RangeControlsProps {
  view: 'week' | 'day';
  setView: (v: 'week' | 'day') => void;
  weekPickerValue: string;
  pickWeekDate: (raw: string) => void;
  shiftWeek: (deltaWeeks: number) => void;
  weekOf: string;
  resetToThisWeek: () => void;
  dayFrom: string;
  setDayFrom: (v: string) => void;
  dayTo: string;
  setDayTo: (v: string) => void;
  displayRange?: string;
  onDownloadCsv?: () => void;
  downloading?: boolean;
}

function RangeControls({
  view, setView, weekPickerValue, pickWeekDate, shiftWeek, weekOf, resetToThisWeek,
  dayFrom, setDayFrom, dayTo, setDayTo, displayRange, onDownloadCsv, downloading,
}: RangeControlsProps) {
  return (
    <FilterBar>
      {view === 'week' ? (
        <FilterBar.Item label="Week of">
          {/* The input's value is a literal echo of the last thing the native picker reported
              (weekPickerValue), NOT the Monday-snapped weekOf used for the query below — feeding
              the picker back a value that differs from what was just clicked (e.g. snapping a
              Thursday pick to that week's Monday) is exactly what makes Chrome/Safari's calendar
              popup flake out on the next click, landing back on whatever was previously selected
              instead of the new pick. Keeping the two decoupled means every click always lands
              correctly; the resolved week is shown via "Showing ..." instead of by rewriting the
              box's own value. Prev/next-week buttons sidestep the calendar popup entirely for the
              common case of stepping a week at a time. */}
          <Button size="sm" variant="ghost" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input type="date" value={weekPickerValue} onChange={(e) => pickWeekDate(e.target.value)} className={FILTER_INPUT} />
          <Button size="sm" variant="ghost" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOf !== thisWeek && (
            <button type="button" onClick={resetToThisWeek} className="ml-1 text-xs font-medium text-primary hover:underline">
              This week
            </button>
          )}
          {displayRange && <span className="ml-2 text-xs text-muted-foreground">Showing {displayRange}</span>}
        </FilterBar.Item>
      ) : (
        <FilterBar.Item label="From">
          {/* Plain, unsnapped date inputs — no value transformation, so there's nothing for the
              native picker to desync over (see the "Week of" comment for what that failure mode
              looks like). Picking any day within a currently-shown month always just works. */}
          <input type="date" value={dayFrom} onChange={(e) => setDayFrom(e.target.value)} className={FILTER_INPUT} />
          <span className="mx-2 text-xs text-muted-foreground">to</span>
          <input type="date" value={dayTo} onChange={(e) => setDayTo(e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
      )}
      <FilterBar.Item label="View">
        <div className="inline-flex rounded-md border border-input p-0.5">
          {(['week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'week' ? 'Week total' : 'By day'}
            </button>
          ))}
        </div>
      </FilterBar.Item>
      {onDownloadCsv && (
        <div className="ml-auto flex items-center gap-1">
          <FilterBar.Divider />
          <button
            type="button"
            disabled={downloading}
            onClick={onDownloadCsv}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {downloading ? 'Loading…' : 'Download CSV'}
          </button>
        </div>
      )}
    </FilterBar>
  );
}
