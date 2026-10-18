import { Info } from 'lucide-react';
import { useReportingBaseline } from '../../api/reports';
import { formatDate } from '../../lib/dates';

/** Says that a page starts from the reporting baseline, so older records that still exist are not mistaken for missing ones. Nothing when there is none. */
export default function BaselineNote({ className = '' }: { className?: string }) {
  const { data: date } = useReportingBaseline();
  if (!date) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Showing data from {formatDate(date)} onwards. Earlier records are kept, just not included here.
    </p>
  );
}
