import { ClipboardList } from 'lucide-react';
import { FilterBar, FILTER_INPUT } from '../../components/ui/FilterBar';
import { useAuditLog, type AuditLogParams } from '../../api/auditLog';
import { useEngineerList } from '../../api/engineers';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import PageHeader from '../../components/layout/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatDateTime } from '../../lib/dates';


function actionDotClass(action: string): string {
  const verb = action.split('.')[1] ?? '';
  if (/created|added|granted|imported|activated/.test(verb)) return 'bg-emerald-500';
  if (/updated|edited|changed|calibrated/.test(verb))        return 'bg-blue-500';
  if (/deleted|removed|revoked/.test(verb))                  return 'bg-red-500';
  if (/login|logout|password|locked/.test(action))           return 'bg-violet-500';
  if (/completed|done/.test(verb))                           return 'bg-gray-400';
  return 'bg-muted-foreground/30';
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map((s) => s.replace(/_/g, ' '))
    .join(' · ');
}

function actorInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

export default function AuditLogPage() {
  const [filters, setFilter, , clearUrlFilters] = useUrlFilters({ actorId: '', action: '', from: '', to: '' }, ['cursor', 'cursorPage']);
  const { actorId, action, from, to } = filters;

  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination<number>({
    serialize: String, deserialize: Number,
  });
  const { data: engineers } = useEngineerList();

  const hasFilters = !!(actorId || action || from || to);
  const clearFilters = () => clearUrlFilters();

  const params: AuditLogParams = {
    cursor:  cursor,
    limit:   25,
    actorId: actorId || undefined,
    action:  action  || undefined,
    from:    from    || undefined,
    to:      to      || undefined,
  };

  const { data, isLoading, error, refetch } = useAuditLog(params);

  return (
    <div>
      <PageHeader title="Audit log" />

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        <FilterBar.Item label="Actor">
          <SearchableSelect
            value={actorId}
            onChange={(v) => setFilter('actorId', v)}
            placeholder="Search actors…"
            emptyLabel="No matching actors"
            options={[{ value: '', label: 'All' }, ...(engineers?.map((e) => ({ value: e.id, label: e.name })) ?? [])]}
          />
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="Action">
          <input type="text" placeholder="e.g. task.created" value={action} onChange={(e) => setFilter('action', e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="From">
          <input type="date" value={from} onChange={(e) => setFilter('from', e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="To">
          <input type="date" value={to} onChange={(e) => setFilter('to', e.target.value)} className={FILTER_INPUT} />
        </FilterBar.Item>
      </FilterBar>

      {isLoading && <TablePageSkeleton cols={5} hasAction={false} />}
      {error     && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !error && (
        <>
          {data?.items.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardList}
                title={hasFilters ? 'No entries match your filters' : 'No audit log entries yet'}
                description={hasFilters ? 'Try adjusting or clearing your filters.' : 'System actions will appear here as they occur.'}
                action={hasFilters ? <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button> : undefined}
              />
            </Card>
          ) : (
            <Card>
              <div className="flex items-center border-b px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {data?.hasMore ? '25+ entries' : `${data?.items.length} entr${data?.items.length === 1 ? 'y' : 'ies'}`}
                  {hasFilters && <span className="ml-1 text-primary">· filtered</span>}
                </span>
              </div>
              <div className="divide-y divide-border">
                {data?.items.map((entry) => {
                  const actor = engineers?.find((e) => e.id === entry.actorId);
                  const name = actor?.name ?? entry.actorId.slice(0, 8);
                  return (
                    <div key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {actorInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${actionDotClass(entry.action)}`} />
                          <span className="text-sm capitalize text-foreground">{formatAction(entry.action)}</span>
                          <span className="text-sm text-muted-foreground">by {name}</span>
                        </div>
                        {entry.detail && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={entry.detail}>
                            {entry.detail}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(entry.ts)}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{entry.ipAddress ?? '—'}</span>
                    </div>
                  );
                })}
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
