'use client';

import { useInstallPrompt } from '@/lib/useInstallPrompt';

/**
 * Native "Install app" button. Uses the beforeinstallprompt event (Android/
 * desktop Chromium). iOS Safari doesn't fire it, so there we hide the button and
 * the surrounding section shows the Share → Add to Home Screen steps instead.
 */
export function InstallButton() {
  const { canInstall, installed, install } = useInstallPrompt();

  if (installed) {
    return <p className="text-sm font-medium text-success">✓ App installed — open it from your home screen.</p>;
  }
  if (!canInstall) return null;

  return (
    <button type="button" onClick={install} className="btn-accent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Install the app
    </button>
  );
}
