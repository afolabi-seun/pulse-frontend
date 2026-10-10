/** Applying an organization's accent colour to the theme, whose colours are HSL triplets in CSS variables. */

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string | null | undefined): value is string {
  return !!value && HEX.test(value);
}

/** "#B8893B" → "39 51% 48%" (the "H S% L%" form the theme's variables use). */
export function hexToHslTriplet(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** White or near-black text, whichever reads better on the colour (WCAG relative luminance). */
export function readableForeground(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '250 24% 8%' : '0 0% 100%';
}

const VARIABLES = ['--primary', '--ring', '--primary-foreground'] as const;

/** Sets (or, with null / an invalid colour, clears) the organization's accent on an element — the page by default. */
export function applyBrandColor(hex: string | null | undefined, target: HTMLElement = document.documentElement) {
  if (!isHexColor(hex)) {
    VARIABLES.forEach((v) => target.style.removeProperty(v));
    return;
  }
  const hsl = hexToHslTriplet(hex);
  target.style.setProperty('--primary', hsl);
  target.style.setProperty('--ring', hsl);
  target.style.setProperty('--primary-foreground', readableForeground(hex));
}
