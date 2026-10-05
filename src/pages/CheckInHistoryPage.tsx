import { Fragment } from 'react';
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
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '../lib/dates';

const TABLE_CLS = '[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide';

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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className={`${TABLE_CLS} table-fixed`}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Project</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Planned next</TableHead>
                  <TableHead className="w-[22%]">Blocker</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...days.entries()].map(([date, items]) => (
                  <Fragment key={date}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={4} className="!py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatDate(date)}
                      </TableCell>
                    </TableRow>
                    {items.map((ci) => (
                      <TableRow key={ci.id}>
                        <TableCell className="align-top text-sm font-medium text-foreground">{projectName(ci.projectId)}</TableCell>
                        <TableCell className="align-top text-sm text-foreground"><ExpandableText text={ci.completed} /></TableCell>
                        <TableCell className="align-top text-sm text-foreground"><ExpandableText text={ci.plannedNext} /></TableCell>
                        <TableCell className="align-top text-sm">
                          {ci.blockers ? (
                            <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <ExpandableText text={ci.blockers} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
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
