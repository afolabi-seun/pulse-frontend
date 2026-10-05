import { SlidersHorizontal, X } from 'lucide-react';

export const FILTER_SELECT = 'h-8 rounded-md border-0 bg-transparent pl-2 pr-7 text-sm focus:outline-none focus:ring-0 cursor-pointer text-foreground';
// w-32 (not w-28): a native <input type="date">'s own calendar-icon button has a fixed intrinsic
// width the browser reserves regardless of CSS padding — at w-28 there wasn't enough room left for
// the date text beside it, so the icon overlapped the last digit.
export const FILTER_INPUT  = 'h-8 rounded-md border-0 bg-transparent px-2 text-sm focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground w-32';

interface FilterBarProps {
  children: React.ReactNode;
  hasFilters?: boolean;
  onClear?: () => void;
}

// Hidden below sm: it separates side-by-side items on the single-row desktop layout, but once
// the bar wraps onto stacked rows (narrow viewports) each item is already on its own line, so a
// 1px vertical divider has nothing meaningful to separate and only shows up as a stray mark.
function Divider() {
  return <div className="mx-1 hidden h-4 w-px bg-border sm:block" />;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function FilterBar({ children, hasFilters, onClear }: FilterBarProps) {
  return (
    // items-start (not items-center): on a narrow viewport the children wrap onto several
    // stacked rows, and items-center would then center this fixed-size icon against the whole
    // wrapped block's height, floating it in the middle of the stack instead of beside the first
    // row. items-start pins it to the top, which also matches items-center's result on the
    // desktop single-row case (mt-1 nudges it to the row's text baseline instead of its top edge).
    <div className="mb-3 flex items-start gap-2 rounded-xl border bg-card px-3 py-1.5 shadow-sm">
      <SlidersHorizontal className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex flex-1 flex-wrap items-center gap-0.5">
        {children}
      </div>
      {hasFilters && onClear && (
        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}

FilterBar.Item    = Item;
FilterBar.Divider = Divider;
