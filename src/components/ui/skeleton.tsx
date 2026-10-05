import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/* ─── Base primitive ─────────────────────────────────────────────────────── */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
  );
}

/* ─── Shared sub-parts ────────────────────────────────────────────────────── */

function PageHeaderSkeleton({ hasAction = false }: { hasAction?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-60" />
      </div>
      {hasAction && <Skeleton className="h-9 w-24 shrink-0" />}
    </div>
  );
}

/* ─── Table pages ─────────────────────────────────────────────────────────── */

export function TablePageSkeleton({
  cols = 4, rows = 7, hasFilters = false, hasAction = true,
}: {
  cols?: number; rows?: number; hasFilters?: boolean; hasAction?: boolean;
}) {
  return (
    <div>
      <PageHeaderSkeleton hasAction={hasAction} />
      {hasFilters && (
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-32" />
        </div>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: cols }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: cols }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className={cn('h-4', j === 0 ? 'w-36' : j === cols - 1 ? 'w-16' : 'w-24')} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ─── Card list pages ─────────────────────────────────────────────────────── */

export function CardListSkeleton({
  count = 5, hasFilters = false, hasAction = true,
}: {
  count?: number; hasFilters?: boolean; hasAction?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <PageHeaderSkeleton hasAction={hasAction} />
      {hasFilters && <Skeleton className="mb-4 h-9 w-full max-w-xs" />}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── Form pages ──────────────────────────────────────────────────────────── */

export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="max-w-lg">
      <PageHeaderSkeleton />
      <Card>
        <CardContent className="space-y-4 p-6">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="mt-2 h-9 w-28" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Detail pages ────────────────────────────────────────────────────────── */

export function DetailPageSkeleton({ maxW = '2xl' }: { maxW?: string }) {
  return (
    <div className={`max-w-${maxW} space-y-5`}>
      <PageHeaderSkeleton hasAction />
      {/* Primary info card */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Secondary card */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Dashboard ───────────────────────────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <Skeleton className="mt-3 h-8 w-14" />
              <Skeleton className="mt-1.5 h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Workload bar */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </CardContent>
      </Card>
      {/* Task list */}
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn('flex items-center gap-3 px-5 py-3', i < 4 && 'border-b border-border')}>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Stat cards (reports / check-in status) ──────────────────────────────── */

export function StatCardsSkeleton({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-16" />
            <Skeleton className="mt-1 h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
