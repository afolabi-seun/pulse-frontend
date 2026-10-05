import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  value, onChange, options, placeholder = 'Search…', emptyLabel = 'No matches', className, disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  // Rendered in a portal so an ancestor with overflow-hidden (e.g. a Card) never clips the menu.
  useEffect(() => {
    if (!open) return;

    const updateRect = () => {
      const r = containerRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    updateRect();

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    // Closes on an ancestor/page scroll (the anchored position would go stale), but not on
    // scrolling inside the menu's own results list — that scroll event's target is the menu
    // itself, which should just scroll normally rather than close the dropdown.
    const onScrollOrResize = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  useEffect(() => setHighlight(0), [query, open]);

  const selectOption = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) selectOption(filtered[highlight]); }
          else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
        }}
        className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {open && rect && createPortal(
        <div
          ref={menuRef}
          // Explicit pointerEvents wins over the inherited value regardless of where this portal
          // ends up in the DOM — needed because Radix Dialog sets `pointer-events: none` on
          // <body> while open (restoring `auto` only on its own content), and this menu portals
          // to document.body as a sibling of the dialog, not a descendant, so it would otherwise
          // inherit `none` and render fully unclickable.
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, pointerEvents: 'auto' }}
          className="z-50 max-h-56 overflow-y-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {filtered.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground">{emptyLabel}</p>
          )}
          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'block w-full truncate px-3 py-1.5 text-left text-xs',
                i === highlight ? 'bg-muted' : '',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
