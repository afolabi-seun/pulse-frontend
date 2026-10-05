import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from 'react';

interface ScrollFadeXProps {
  /** The single scrollable element (e.g. a `<div className="overflow-x-auto">` or a `<Card
   * className="overflow-auto">`) to overlay edge hints on. Cloned to attach a ref + onScroll
   * without requiring the child to change its own styling. */
  children: ReactElement;
}

/** Wraps a horizontally-scrollable region (a wide table, a weekly grid) and shows a subtle
 * gradient at whichever edge still has more content past it — swiping works fine on its own, but
 * nothing else hints that there's more to scroll to, which is easy to miss on a phone where the
 * cut-off columns don't look obviously truncated. */
export function ScrollFadeX({ children }: ScrollFadeXProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = () => {
    const el = elRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    update();
    const el = elRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  });

  if (!isValidElement(children)) return children;

  const child = children as ReactElement<{ ref?: React.Ref<HTMLElement>; onScroll?: React.UIEventHandler }>;

  return (
    <div className="relative">
      {cloneElement(child, {
        ref: (node: HTMLElement | null) => { elRef.current = node; },
        onScroll: update,
      })}
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent" />
      )}
    </div>
  );
}
