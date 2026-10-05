import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useEscalations } from '../api/escalations';
import { useEngineerList } from '../api/engineers';
import TaskPreviewDrawer from '../components/tasks/TaskPreviewDrawer';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/ui/Badge';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDate } from '../lib/dates';
import type { EscalationDto, EscalationLevel } from '../types/api';

const GROUP_CAP = 8;

const LEVEL_LABEL: Record<EscalationLevel, string> = {
  TMinus3: 'T-3', TMinus1: 'T-1', Overdue: 'Overdue',
};
const LEVEL_VARIANT: Record<EscalationLevel, 'yellow' | 'red'> = {
  TMinus3: 'yellow', TMinus1: 'red', Overdue: 'red',
};
const LEVEL_ACCENT: Record<EscalationLevel, string> = {
  TMinus3: 'border-l-yellow-400', TMinus1: 'border-l-amber-500', Overdue: 'border-l-destructive',
};

function EscalationRow({ esc, assigneeName, onOpenTask }: {
  esc: EscalationDto; assigneeName: string; onOpenTask: (taskId: string) => void;
}) {
  return (
    <div
      className={cn('flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 border-l-4 px-4 py-3 transition-colors hover:bg-muted/30', LEVEL_ACCENT[esc.level])}
      onClick={() => onOpenTask(esc.taskId)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {esc.taskKey && <span className="shrink-0 font-mono text-xs text-muted-foreground">{esc.taskKey}</span>}
        <span className="truncate font-medium text-foreground hover:text-primary">{esc.taskTitle}</span>
        <Badge label={LEVEL_LABEL[esc.level]} variant={LEVEL_VARIANT[esc.level]} />
      </div>
      <span className="shrink-0 text-sm text-muted-foreground">{esc.projectName ?? '—'}</span>
      <span className="shrink-0 text-sm text-muted-foreground">{assigneeName}</span>
      <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {esc.dueDate ? formatDate(esc.dueDate) : 'No due date'}
      </span>
      <span className="shrink-0 whitespace-nowrap text-right font-mono text-sm tabular-nums">
        {esc.daysUntilDue < 0 ? (
          <span className="font-medium text-destructive">{Math.abs(esc.daysUntilDue)}d late</span>
        ) : (
          <span className="text-muted-foreground">{esc.daysUntilDue}d remaining</span>
        )}
      </span>
    </div>
  );
}

function EscalationGroup({
  label, icon, items, engineers, onOpenTask,
}: {
  label: string;
  icon: React.ReactNode;
  items: EscalationDto[];
  engineers: { id: string; name: string }[];
  onOpenTask: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const capped = !expanded && items.length > GROUP_CAP;
  const visible = capped ? items.slice(0, GROUP_CAP) : items;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {icon}
        <h2 className="text-sm font-medium text-foreground">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {visible.map((esc) => (
          <EscalationRow
            key={esc.taskId}
            esc={esc}
            assigneeName={engineers.find((e) => e.id === esc.assigneeId)?.name ?? 'Unassigned'}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
      {items.length > GROUP_CAP && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-xs font-medium text-primary hover:bg-muted/40"
        >
          {expanded ? (
            <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Show all {items.length} <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>
      )}
    </Card>
  );
}

export default function EscalationsPage() {
  const { data: escalations, isLoading, error, refetch } = useEscalations();
  const { data: engineers } = useEngineerList();
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  if (isLoading) return <TablePageSkeleton cols={5} hasAction={false} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const eng       = engineers ?? [];
  const overdue   = escalations?.filter((e) => e.level === 'Overdue')  ?? [];
  const tMinus1   = escalations?.filter((e) => e.level === 'TMinus1')  ?? [];
  const tMinus3   = escalations?.filter((e) => e.level === 'TMinus3')  ?? [];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Escalations"
        description="Tasks approaching or past their due date"
      />

      {escalations?.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="All tasks on track"
            description="No active escalations right now."
            className="[&_svg]:text-emerald-500"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <EscalationGroup
            label="Overdue"
            icon={<AlertCircle className="h-4 w-4 text-red-500" />}
            items={overdue}
            engineers={eng}
            onOpenTask={setPreviewTaskId}
          />
          <EscalationGroup
            label="Due tomorrow"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            items={tMinus1}
            engineers={eng}
            onOpenTask={setPreviewTaskId}
          />
          <EscalationGroup
            label="Due in 3 days"
            icon={<Clock className="h-4 w-4 text-yellow-500" />}
            items={tMinus3}
            engineers={eng}
            onOpenTask={setPreviewTaskId}
          />
        </div>
      )}

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}
