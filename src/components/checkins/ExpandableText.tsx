import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Long enough that clamping helps: more than this many characters, or more than 3 lines. */
const LONG_CHARS = 180;
const LONG_LINES = 3;

export function isLongText(text: string): boolean {
  return text.length > LONG_CHARS || text.split('\n').length > LONG_LINES;
}

// Written out in full so Tailwind sees the class names.
const CLAMP: Record<number, string> = { 2: 'line-clamp-2', 3: 'line-clamp-3' };

/**
 * Free text (a check-in's "completed", "planned next" or blocker) that is clamped to `lines` lines with a
 * "Show more" when it is long, so one very long entry can't stretch a table row or a card. Short text is
 * shown as is. Line breaks are kept.
 *
 * "Long" is judged two ways: by length (a safe default before anything is laid out), and by how the text
 * actually wraps in the space it is given — a 150-character entry in a narrow table column can run to four or
 * five lines, which a character count alone would let through.
 */
export default function ExpandableText({ text, className, lines = 3 }: { text: string; className?: string; lines?: 2 | 3 }) {
  const [open, setOpen] = useState(false);
  const [wraps, setWraps] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const long = isLongText(text) || wraps;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      // line-height can compute to "normal"; fall back to a typical 1.25 × font size (16px if that is unknown too).
      const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.25;
      // scrollHeight is the text's full height whether or not it is currently clamped.
      setWraps(el.scrollHeight > lineHeight * lines + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines]);

  return (
    <div className={className}>
      <p ref={ref} className={cn('whitespace-pre-wrap break-words', long && !open && CLAMP[lines])}>{text}</p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
