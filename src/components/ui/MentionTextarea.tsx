import { useRef, useState, forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Textarea, type TextareaProps } from './textarea';
import { cn } from '@/lib/utils';

export interface MentionCandidate {
  id: string;
  name: string;
}

interface MentionTextareaProps extends Omit<TextareaProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Candidate pool to autocomplete against — the task's mention candidates from the backend
   * (GetTaskMentionCandidatesQuery), which already applies the right access boundary AND always
   * includes the task's own creator regardless of their active/access status. Trusted as-is: no
   * active-only re-filtering here, which would otherwise silently undo that creator guarantee for
   * anyone who's since been deactivated. */
  engineers: MentionCandidate[] | undefined;
}

/** Matches an in-progress "@partial name" right before the caret — "@" must start the text or
 * follow whitespace, so an email address or a mid-word "@" doesn't trigger the dropdown. The name
 * part is optional: a bare "@" opens the list with everyone, and it narrows as you type. */
const MENTION_PATTERN = /(?:^|\s)@([a-zA-Z][\w'-]*(?: [a-zA-Z][\w'-]*)*)?$/;

/** How many names the list can hold before it stops growing (it scrolls well before this). Keeps a very
 * large organization from rendering hundreds of rows for a bare "@"; typing narrows it long before that matters. */
const MAX_SUGGESTIONS = 50;

/** Lower is a better match: a name starting with what was typed, then a name with a WORD starting with it
 * ("ke" -> Kemi Rokosu before Nike Adelakun, where "ke" is only buried inside "Nike"), then any other
 * containing it. -1 when it doesn't match at all. An empty query matches everyone equally. */
function matchRank(name: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (q === '') return 0;
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 0;
  if (n.split(/[\s'-]+/).some((word) => word.startsWith(q))) return 1;
  return n.includes(q) ? 2 : -1;
}

const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ value, onChange, engineers, className, onKeyDown, onBlur, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [query, setQuery] = useState<string | null>(null);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [highlighted, setHighlighted] = useState(0);
    const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

    const setRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    };

    const suggestions = query !== null
      ? (engineers ?? [])
          .map((e, order) => ({ e, order, rank: matchRank(e.name, query) }))
          .filter((x) => x.rank >= 0)
          .sort((a, b) => a.rank - b.rank || a.order - b.order)
          .slice(0, MAX_SUGGESTIONS)
          .map((x) => x.e)
      : [];
    const showSuggestions = query !== null && suggestions.length > 0;

    // Rendered in a portal so an ancestor with overflow-hidden (e.g. the Comments card) never
    // clips the dropdown — same fix as SearchableSelect uses for the same problem.
    useEffect(() => {
      if (!showSuggestions) return;

      const updateRect = () => {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) setRect({ top: r.bottom + 4, left: r.left });
      };
      updateRect();

      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }, [showSuggestions]);

    // Arrowing down a long list must keep the highlighted name in view.
    const listRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      if (!showSuggestions) return;
      (listRef.current?.children[highlighted] as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
    }, [highlighted, showSuggestions]);

    const detectMention = (text: string, caret: number) => {
      const match = MENTION_PATTERN.exec(text.slice(0, caret));
      if (match) {
        const typed = match[1] ?? '';
        setQuery(typed);
        setMentionStart(caret - typed.length - 1);
        setHighlighted(0);
      } else {
        setQuery(null);
        setMentionStart(null);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
    };

    const selectMention = (name: string) => {
      if (mentionStart === null || query === null) return;
      const caret = mentionStart + 1 + query.length;
      const before = value.slice(0, mentionStart);
      const after = value.slice(caret);
      const inserted = `@${name} `;
      const next = before + inserted + after;
      onChange(next);
      setQuery(null);
      setMentionStart(null);
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length;
        innerRef.current?.focus();
        innerRef.current?.setSelectionRange(pos, pos);
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSuggestions) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((i) => (i + 1) % suggestions.length); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(suggestions[highlighted].name); return; }
        if (e.key === 'Escape') { e.preventDefault(); setQuery(null); setMentionStart(null); return; }
      }
      onKeyDown?.(e);
    };

    return (
      <div ref={containerRef} className="relative">
        <Textarea
          {...props}
          ref={setRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={(e) => { setTimeout(() => setQuery(null), 100); onBlur?.(e); }}
          className={className}
        />
        {showSuggestions && rect && createPortal(
          <div
            ref={listRef}
            // pointerEvents: a modal Dialog/Sheet (the task preview drawer) switches off pointer events on <body> and everything portaled to it, so
            // without this the names could be picked with the keyboard but not clicked. SearchableSelect's menu does the same.
            style={{ position: 'fixed', top: rect.top, left: rect.left, pointerEvents: 'auto' }}
            className="z-50 max-h-56 w-56 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          >
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectMention(s.name); }}
                className={cn(
                  'block w-full truncate px-3 py-1.5 text-left text-sm',
                  i === highlighted ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    );
  },
);
MentionTextarea.displayName = 'MentionTextarea';

export default MentionTextarea;
