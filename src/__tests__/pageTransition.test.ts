import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * jsdom does no layout, so this guards the cause directly. The page wrapper animates with a `transform`; if the
 * animation keeps its end state (`forwards`/`both`), that transform stays applied and the wrapper becomes the
 * containing block for every `position: fixed` element inside a page, so drawers and bars are positioned against
 * the whole page instead of the viewport.
 */
describe('page transition', () => {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
  const rule = css.match(/\.page-transition\s*\{([^}]*)\}/)?.[1] ?? '';

  it('is declared', () => {
    expect(rule).toContain('animation:');
  });

  it('does not hold its end state, which would leave a transform on the page wrapper', () => {
    expect(rule).not.toMatch(/\b(forwards|both)\b/);
  });

  it('does not set a transform of its own either', () => {
    expect(rule).not.toMatch(/\btransform\s*:/);
  });
});
