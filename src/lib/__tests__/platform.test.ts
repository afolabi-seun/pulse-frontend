import { describe, it, expect } from 'vitest';
import { isApplePlatform, searchShortcutLabel } from '../platform';

describe('platform', () => {
  it('writes the search shortcut with ⌘ on Apple platforms and Ctrl everywhere else', () => {
    expect(searchShortcutLabel('MacIntel')).toBe('⌘K');
    expect(searchShortcutLabel('iPad')).toBe('⌘K');
    expect(searchShortcutLabel('Win32')).toBe('Ctrl K');
    expect(searchShortcutLabel('Linux x86_64')).toBe('Ctrl K');
  });

  it('treats an unknown platform as not Apple', () => {
    expect(isApplePlatform('')).toBe(false);
  });
});
