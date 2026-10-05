import { useMemo } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTimeEntryHistory } from '../api/timeEntries';
import { useTaskList } from '../api/tasks';
import { useCursorPagination } from '../hooks/useCursorPagination';
import PageHeader from '../components/layout/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { CardListSkeleton } from '@/components/ui/skeleton';
import ErrorState from '../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { formatDate } from '../lib/dates';

const CATEGORY_LABEL: Record<string, string> = {
  task: 'Task', meeting: 'Meeting', admin: 'Admin', leave: 'Leave', other: 'Other',
};

export default function MyTimeHistoryPage() {
  const { currentUser } = useAuth();
  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination();

  const { data, isLoading, error, refetch } = useTimeEntryHistory(currentUser!.id, cursor);
  const { data: myTasks } = useTaskList({ assigneeId: currentUser!.id, limit: 100 });

  const taskTitleById = useMemo(
    () => new Map((myTasks?.items ?? []).map((t) => [t.id, t.taskKey ? `${t.taskKey} — ${t.title}` : t.title])),
    [myTasks],
  );

  if (isLoading) return <CardListSkeleton count={5} hasAction={false} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Time history" />

      {data?.items.length === 0 ? (
        <Card>
          <EmptyState icon={Clock} title="No time entries yet" description="Your logged time will appear here." />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {data?.items.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {entry.taskId
                    // taskTitleById only covers currently-assigned tasks; entry.taskTitle is
                    // resolved server-side independently of that, so a task done/reassigned since
                    // this entry was logged still shows its real name instead of the word "Task".
                    ? taskTitleById.get(entry.taskId) ?? entry.taskTitle ?? 'Task'
                    : CATEGORY_LABEL[entry.category]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.date)}{entry.note ? ` · ${entry.note}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">{entry.hours}h</span>
            </div>
          ))}
        </Card>
      )}

      <Pagination
        hasPrev={hasPrev}
        hasMore={data?.hasMore ?? false}
        onPrev={goPrev}
        onNext={() => data?.nextCursor && goNext(data.nextCursor)}
        page={pageNumber}
      />
    </div>
  );
}
