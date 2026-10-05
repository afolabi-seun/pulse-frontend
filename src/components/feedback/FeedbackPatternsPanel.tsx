import { BarChart2, ChevronRight, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { weekLabel } from '../../lib/dates';
import type { FeedbackPatternsDto } from '../../types/api';

const MIN_PEOPLE = 3;
const CHART_WEEKS = 12;

/** The anonymised weekly rollup of the feedback inbox: how much feedback came in and what share of
 * the team gave it, week over week — not the content of what was said (that's the Entries tab). A
 * week is only shown with enough people behind it; the rest are counted, not shown. */
export default function FeedbackPatternsPanel({ patterns, onOpenWeek }: {
  patterns: FeedbackPatternsDto;
  /** Jump to that week's entries. */
  onOpenWeek: (weekOf: string) => void;
}) {
  const { weeks, hiddenWeeks, eligiblePeople, scope } = patterns;
  const hiddenNote = hiddenWeeks > 0
    ? ` ${hiddenWeeks} other week${hiddenWeeks === 1 ? ' has' : 's have'} feedback but fewer than ${MIN_PEOPLE} people behind it, so ${hiddenWeeks === 1 ? 'it isn\'t' : 'they aren\'t'} shown.`
    : '';

  return (
    <>
      <div className="mb-4 flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This is a trend of <strong>how much feedback came in and how many people took part</strong>, week
          by week — not what anyone said (open a week below to read that in Entries).{' '}
          <span className="font-medium">{scope === 'Organisation' ? 'Whole organisation' : scope}.</span>{' '}
          A week only appears once at least {MIN_PEOPLE} different people have given feedback, so no one can be
          singled out.{hiddenNote}
        </p>
      </div>

      {weeks.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No weeks to show yet"
          description={`A week needs feedback from at least ${MIN_PEOPLE} different people before it appears here.`}
        />
      ) : (
        <div className="space-y-4">
          <TrendChart weeks={weeks} />
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-right">Responses</TableHead>
                    {eligiblePeople > 0
                      ? <TableHead className="w-44">Took part</TableHead>
                      : <TableHead className="text-right">People</TableHead>}
                    <TableHead className="w-6"><span className="sr-only">Open</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((w) => {
                    const share = eligiblePeople > 0 ? Math.min(100, Math.round((w.distinctSources / eligiblePeople) * 100)) : 0;
                    return (
                      <TableRow key={w.weekOf} className="cursor-pointer" onClick={() => onOpenWeek(w.weekOf)}>
                        <TableCell className="text-foreground">
                          <button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); onOpenWeek(w.weekOf); }}>
                            {weekLabel(w.weekOf)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{w.totalResponses}</TableCell>
                        {eligiblePeople > 0 ? (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                              </div>
                              {/* The percentage leads: it's the one number that's comparable week to week,
                                  the raw "X of Y" is context for anyone who wants to check the math. */}
                              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                                {share}% <span className="text-muted-foreground/70">({w.distinctSources} of {eligiblePeople})</span>
                              </span>
                            </div>
                          </TableCell>
                        ) : (
                          <TableCell className="text-right tabular-nums text-muted-foreground">{w.distinctSources}</TableCell>
                        )}
                        <TableCell className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
          <p className="text-[11px] text-muted-foreground">
            “Took part” compares each week with today's headcount{scope === 'Organisation' ? '' : ' in this department'}, so older weeks are approximate.
          </p>
        </div>
      )}
    </>
  );
}

/** Responses per week, oldest on the left, so a rising or falling trend reads at a glance. */
function TrendChart({ weeks }: { weeks: FeedbackPatternsDto['weeks'] }) {
  const recent = weeks.slice(0, CHART_WEEKS).slice().reverse();
  const max = Math.max(...recent.map((w) => w.totalResponses), 1);
  return (
    <Card className="px-4 pb-3 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responses per week</p>
      <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Responses per week, last ${recent.length} qualifying weeks`}>
        {recent.map((w) => (
          <div key={w.weekOf} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
               title={`${weekLabel(w.weekOf)} — ${w.totalResponses} responses from ${w.distinctSources} people`}>
            <span className="text-[10px] tabular-nums text-muted-foreground">{w.totalResponses}</span>
            <div className="w-full max-w-[2.5rem] rounded-t bg-primary/80" style={{ height: `${Math.max(6, (w.totalResponses / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {recent.map((w) => (
          <span key={w.weekOf} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
            {new Date(w.weekOf + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        ))}
      </div>
    </Card>
  );
}
