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
 * follow whitespace, so an email address or a mid-word "@" doesn't trigger the dropdown. */
const MENTION_PATTERN = /(?:^|\s)@([a-zA-Z][\w'-]*(?: [a-zA-Z][\w'-]*)*)$/;

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
          .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6)
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

    const detectMention = (text: string, caret: number) => {
      const match = MENTION_PATTERN.exec(text.slice(0, caret));
      if (match) {
        setQuery(match[1]);
        setMentionStart(caret - match[1].length - 1);
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
            style={{ position: 'fixed', top: rect.top, left: rect.left }}
            className="z-50 w-56 overflow-hidden rounded-md border border-border bg-popover shadow-md"
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
