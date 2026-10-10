import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  /** A short unit shown small beside the value ("pts", "days", "hrs"), so the label underneath can stay a phrase. */
  unit?: string;
  icon: React.ReactNode;
  iconBg?: string;
  sub?: string;
  /** Colours the sub line when it states a direction (a change against last week). */
  subTone?: 'good' | 'bad';
  accent?: 'red' | 'yellow';
  to?: string;
  /** Said on hover — what the number is measured on, when that doesn't fit in the tile. */
  hint?: string;
}

/** The grid a row of tiles uses: as many columns as fit at a readable width, wrapping instead of squeezing every tile into one row. */
export const STAT_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3';

/** A headline number with its label, icon and an optional line of context — the one tile every summary row in Pulse uses. */
export default function StatCard({ title, value, unit, icon, iconBg, sub, subTone, accent, to, hint }: StatCardProps) {
  const content = (
    <CardContent className="flex h-full flex-col gap-1 p-4">
      {/* Title and icon share one line, the title taking whatever the icon leaves, so a long title is shortened with an ellipsis (and a tooltip)
          instead of being clipped by its neighbour or wrapping and pushing the value out of line with the other tiles. */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground" title={title}>{title}</p>
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          iconBg ?? 'bg-muted',
        )}>
          {icon}
        </div>
      </div>
      <p className={cn(
        'flex items-baseline gap-1 font-mono text-3xl font-bold tabular-nums tracking-tight',
        accent === 'red' ? 'text-red-600' : accent === 'yellow' ? 'text-amber-600' : 'text-foreground',
      )}>
        {value}
        {unit && <span className="font-sans text-sm font-medium tracking-normal text-muted-foreground">{unit}</span>}
      </p>
      {sub && (
        <p className={cn(
          'line-clamp-2 text-xs leading-snug',
          subTone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
            : subTone === 'bad' ? 'text-red-600 dark:text-red-400'
            : 'text-muted-foreground/80',
        )}>
          {sub}
        </p>
      )}
    </CardContent>
  );

  return (
    <Card title={hint} className={cn(
      'h-full transition-shadow hover:shadow-md',
      accent === 'red'    ? 'border-red-200 dark:border-red-900/40'    : '',
      accent === 'yellow' ? 'border-amber-200 dark:border-amber-900/40' : '',
    )}>
      {to ? <Link to={to} className="block h-full">{content}</Link> : content}
    </Card>
  );
}
