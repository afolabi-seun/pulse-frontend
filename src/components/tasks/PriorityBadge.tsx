import { useMeta } from '@/api/meta';
import { cn } from '@/lib/utils';
import { PRIORITY_LABEL, PRIORITY_COLORS } from '@/lib/taskStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Matches TaskBoard's compact chip row (alongside Severity/Type) at small size, and the softer
// pill used in TaskPreviewDrawer/TaskDetailPage at default size — same label lookup and tooltip
// either way, so priority never again renders as a literal "P{n}" with no shared meaning.
const COMPACT_CLS: Record<number, string> = {
  5: 'bg-red-500 text-white',
  4: 'bg-orange-400 text-white',
  3: 'bg-amber-400 text-white',
  2: 'bg-blue-400 text-white',
  1: 'bg-slate-400 text-white',
};

interface PriorityBadgeProps {
  priority: number | null | undefined;
  size?: 'default' | 'compact';
}

export default function PriorityBadge({ priority, size = 'default' }: PriorityBadgeProps) {
  const { data: meta } = useMeta();

  if (!priority) return null;

  const label = PRIORITY_LABEL[priority] ?? `P${priority}`;
  const entry = meta?.priorityScale?.find((e) => e.value === priority);

  const badge = size === 'compact' ? (
    <span
      tabIndex={0}
      className={cn(
        'rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        COMPACT_CLS[priority] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  ) : (
    <span
      tabIndex={0}
      className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', PRIORITY_COLORS[priority] ?? 'bg-muted text-muted-foreground')}
    >
      {label}
    </span>
  );

  if (!entry) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-0.5 px-3 py-2 text-left">
          <p className="font-semibold">{entry.label}</p>
          <p className="text-xs font-normal leading-relaxed opacity-90">{entry.criteria}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
