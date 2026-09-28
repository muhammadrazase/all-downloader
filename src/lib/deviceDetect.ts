export type SaveMode = 'install' | 'ios' | 'mobile-generic' | 'shortcut-mac' | 'shortcut-other';

/**
 * Picks the correct "keep this site handy" affordance for the current
 * device/browser. Installable (Android/desktop Chromium) beats a bookmark
 * since it's more durable and discoverable; every other combination gets an
 * accurate fallback instead of a broken or generic message.
 */
export function detectSaveMode(canInstall: boolean, userAgent: string, platform: string, maxTouchPoints: number): SaveMode {
  if (canInstall) return 'install';
  // iPadOS 13+ reports itself as "MacIntel" in both UA and platform — a real
  // Mac never has more than one touch point, so this is the reliable split.
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  if (isIOS) return 'ios';
  const isMobile = isIOS || /Android|Mobile/.test(userAgent);
  if (isMobile) return 'mobile-generic';
  return /Mac/.test(platform || userAgent) ? 'shortcut-mac' : 'shortcut-other';
}
