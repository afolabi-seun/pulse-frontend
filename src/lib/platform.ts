/** True on Apple platforms, where shortcuts use ⌘ instead of Ctrl. */
export function isApplePlatform(platform: string = navigator.platform ?? ''): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** How the search shortcut is written on this machine: "⌘K" on a Mac, "Ctrl K" elsewhere. Both open it everywhere. */
export function searchShortcutLabel(platform?: string): string {
  return isApplePlatform(platform) ? '⌘K' : 'Ctrl K';
}
