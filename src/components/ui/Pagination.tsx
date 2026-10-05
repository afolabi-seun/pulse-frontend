import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

interface PaginationProps {
  hasPrev: boolean;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  page?: number;
}

export function Pagination({ hasPrev, hasMore, onPrev, onNext, page }: PaginationProps) {
  return (
    <div className="mt-4 flex items-center justify-end gap-1">
      {page !== undefined && (
        <span className="mr-2 text-xs text-muted-foreground">Page {page}</span>
      )}
      <Button size="sm" variant="ghost" disabled={!hasPrev} onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <Button size="sm" variant="ghost" disabled={!hasMore} onClick={onNext}>
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
