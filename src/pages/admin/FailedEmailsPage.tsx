import { Mail, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFailedEmails, useRetryFailedEmail, useRetryAllFailedEmails, useDismissFailedEmail } from '../../api/failedEmails';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import PageHeader from '../../components/layout/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { formatDateTime } from '../../lib/dates';

export default function FailedEmailsPage() {
  const [filters, setFilter] = useUrlFilters({ includeResolved: 'false' }, ['cursor', 'cursorPage']);
  const includeResolved = filters.includeResolved === 'true';

  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination<string>();

  const params = { includeResolved, limit: 25, cursor: cursor ?? undefined };
  const { data, isLoading, error, refetch } = useFailedEmails(params);

  const retryOne   = useRetryFailedEmail();
  const retryAll   = useRetryAllFailedEmails();
  const dismissOne = useDismissFailedEmail();

  function handleRetry(id: string) {
    retryOne.mutate(id, {
      onSuccess: () => toast.success('Email sent successfully.'),
      onError:   () => toast.error('Retry failed. Check server logs.'),
    });
  }

  function handleRetryAll() {
    retryAll.mutate(undefined, {
      onSuccess: (r) => toast.success(`Retry-all: ${r.succeeded} sent, ${r.failed} still failed.`),
      onError:   () => toast.error('Retry-all failed.'),
    });
  }

  function handleDismiss(id: string) {
    dismissOne.mutate(id, {
      onSuccess: () => toast.success('Email dismissed.'),
      onError:   () => toast.error('Could not dismiss.'),
    });
  }

  const hasUnresolved = (data?.items ?? []).some((e) => !e.isResolved);

  return (
    <div>
      <PageHeader
        title="Failed emails"
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(e) => setFilter('includeResolved', e.target.checked ? 'true' : 'false')}
                className="rounded"
              />
              Show resolved
            </label>
            {hasUnresolved && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRetryAll}
                disabled={retryAll.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry all
              </Button>
            )}
          </div>
        }
      />

      {isLoading && <TablePageSkeleton cols={5} hasAction />}
      {error     && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !error && (
        <>
          {data?.items.length === 0 ? (
            <Card>
              <EmptyState
                icon={Mail}
                title={includeResolved ? 'No failed email records' : 'No pending failed emails'}
                description={
                  includeResolved
                    ? 'No failed emails have been logged.'
                    : 'All emails delivered successfully, or none logged yet.'
                }
                action={
                  !includeResolved ? (
                    <button
                      onClick={() => setFilter('includeResolved', 'true')}
                      className="text-xs text-primary hover:underline"
                    >
                      Show resolved
                    </button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <Card>
              <div className="flex items-center border-b px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {data?.hasMore ? '25+ records' : `${data?.items.length} record${data?.items.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <div className="divide-y divide-border">
                {data?.items.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn('flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3', entry.isResolved && 'opacity-50')}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm text-foreground">{entry.to}</span>
                        <Badge
                          label={entry.isResolved ? 'Resolved' : 'Pending'}
                          variant={entry.isResolved ? 'green' : 'red'}
                        />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground" title={entry.subject}>
                        {entry.subject}
                      </p>
                      {entry.lastError && (
                        <p className="mt-1 truncate text-xs text-destructive" title={entry.lastError}>
                          {entry.lastError}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.attemptCount} attempt{entry.attemptCount === 1 ? '' : 's'} · last {formatDateTime(entry.lastAttemptAt)}
                      </p>
                    </div>
                    {!entry.isResolved && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          title="Retry"
                          className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                          onClick={() => handleRetry(entry.id)}
                          disabled={retryOne.isPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Dismiss"
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                          onClick={() => handleDismiss(entry.id)}
                          disabled={dismissOne.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Pagination
            hasPrev={hasPrev}
            hasMore={data?.hasMore ?? false}
            onPrev={goPrev}
            onNext={() => data?.nextCursor != null && goNext(data.nextCursor)}
            page={pageNumber}
          />
        </>
      )}
    </div>
  );
}
