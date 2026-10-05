import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Resolves an `--hsl-triple` CSS custom property to a literal `hsl(...)` color.
 * Canvas contexts (e.g. Chart.js) can't parse `var(--x)` inside color strings —
 * only the CSSOM does that — so chart colors need this instead of raw var() refs.
 */
export function hslVar(name: string, alpha?: number): string {
  if (typeof window === 'undefined') return '#000';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
}
