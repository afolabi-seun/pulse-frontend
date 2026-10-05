import { useAuth } from '../hooks/useAuth';
import { useCheckInHistory } from '../api/checkIns';
import { useMyProjects } from '../api/projects';
import { useCursorPagination } from '../hooks/useCursorPagination';
import PageHeader from '../components/layout/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import ExpandableText from '../components/checkins/ExpandableText';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { CardListSkeleton } from '@/components/ui/skeleton';
import ErrorState from '../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '../lib/dates';

export default function CheckInHistoryPage() {
  const { currentUser } = useAuth();
  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination();

  const { data, isLoading, error, refetch } = useCheckInHistory(currentUser!.id, cursor);
  const { data: myProjects } = useMyProjects();

  const projectName = (id: string | null) =>
    id ? (myProjects?.find((p) => p.id === id)?.name ?? id) : 'General';

  if (isLoading) return <CardListSkeleton count={5} hasAction={false} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  // Newest first, grouped under a heading per day (a day can hold one check-in per project).
  const days = new Map<string, NonNullable<typeof data>['items']>();
  for (const ci of data?.items ?? []) days.set(ci.date, [...(days.get(ci.date) ?? []), ci]);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Check-in history" />

      {data?.items.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No check-ins yet" description="Your daily check-ins will appear here." />
        </Card>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([date, items]) => (
            <div key={date}>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formatDate(date)}</h2>
              <div className="space-y-2.5">
                {items.map((ci) => (
                  <Card key={ci.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <p className="mb-2.5 text-sm font-medium text-foreground">{projectName(ci.projectId)}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
                          <div className="mt-0.5 text-sm text-foreground"><ExpandableText text={ci.completed} /></div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Planned next</p>
                          <div className="mt-0.5 text-sm text-foreground"><ExpandableText text={ci.plannedNext} /></div>
                        </div>
                      </div>
                      {ci.blockers && (
                        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <ExpandableText text={ci.blockers} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
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
