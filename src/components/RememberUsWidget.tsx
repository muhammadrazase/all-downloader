'use client';

import { useEffect, useRef, useState } from 'react';
import { useInstallPrompt } from '@/lib/useInstallPrompt';
import { detectSaveMode, type SaveMode } from '@/lib/deviceDetect';

type Mode = SaveMode;

/**
 * Persistent floating widget (bottom-left, mirrors SupportWidget on the right)
 * nudging visitors to keep SnapVidly within reach for next time. Prefers an
 * actual one-tap install (Android/desktop Chromium) over a bookmark, since an
 * install is more durable and discoverable than a browser bookmark; every
 * other platform/browser combination gets an accurate, always-correct
 * fallback instead of a broken or generic message.
 */
export function RememberUsWidget() {
  const { standalone, canInstall, installed, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(detectSaveMode(canInstall, navigator.userAgent, navigator.platform || '', navigator.maxTouchPoints || 0));
  }, [canInstall]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Already installed (at load, or just now) — nothing left to offer.
  if (standalone === null || mode === null) return null;
  if (standalone || installed) return null;

  return (
    <div ref={ref} className="fixed bottom-5 left-5 z-40">
      <div
        role="dialog"
        aria-label="Keep SnapVidly close"
        aria-hidden={!open}
        inert={!open}
        className={`absolute bottom-14 left-0 w-72 origin-bottom-left rounded-2xl border border-surface-border bg-surface p-5 shadow-lg transition-all duration-200 ease-enter ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <BookmarkGlyph size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Keep SnapVidly close</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {mode === 'install' && "Install it once, and it's always one tap away, exactly when you need it."}
              {mode === 'ios' && "Tap the Share icon below, then Add to Home Screen. One tap and you're back anytime."}
              {mode === 'mobile-generic' && 'Open your browser menu and add SnapVidly to your home screen, so it stays within reach.'}
              {(mode === 'shortcut-mac' || mode === 'shortcut-other') &&
                "Bookmark this page and however you come back, we'll be right here."}
            </p>
          </div>
        </div>

        <div className="mt-4">
          {mode === 'install' && (
            <button type="button" onClick={install} className="btn-accent w-full text-sm">
              Install SnapVidly
            </button>
          )}
          {mode === 'ios' && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-surface-soft py-2.5 text-sm font-medium text-ink-muted">
              <ShareGlyph size={16} />
              Share <span aria-hidden="true">→</span> Add to Home Screen
            </div>
          )}
          {mode === 'mobile-generic' && (
            <div className="rounded-lg bg-surface-soft px-3 py-2.5 text-center text-sm font-medium text-ink-muted">
              Menu → Add to Home Screen
            </div>
          )}
          {(mode === 'shortcut-mac' || mode === 'shortcut-other') && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-soft py-2.5">
              <Key>{mode === 'shortcut-mac' ? '⌘' : 'Ctrl'}</Key>
              <span className="text-ink-faint">+</span>
              <Key>D</Key>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close' : 'Keep SnapVidly close'}
        className="flex items-center gap-2 rounded-full border border-surface-border bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-lg transition-[border-color,color,transform] duration-150 ease-enter hover:border-accent/30 hover:text-accent hover:-translate-y-0.5 active:translate-y-0 active:scale-95 active:duration-100"
      >
        <BookmarkGlyph size={18} />
        Remember us
      </button>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-surface-border bg-surface px-2 py-1 text-sm font-semibold text-ink shadow-sm">
      {children}
    </kbd>
  );
}

function BookmarkGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v17l-6-4.5L6 21V4z" />
    </svg>
  );
}

function ShareGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
