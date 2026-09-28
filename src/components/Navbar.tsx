'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { nav } from '@/lib/site';

/** Top strip — tool navigation lives in the persistent Sidebar; this carries the
 * brand mark and site-level links (not tools), so it never sits empty on desktop. */
export function Navbar({ mobileOpen, onToggleMobile }: { mobileOpen: boolean; onToggleMobile: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/85 backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
          {nav.primary.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-soft hover:text-ink"
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface-soft hover:text-ink md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={onToggleMobile}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
