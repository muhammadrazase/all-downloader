'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { PlatformIcon } from './PlatformIcon';
import { nav } from '@/lib/site';
import { PLATFORM_LIST } from '@/lib/platforms';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { AI_TOOL_LIST } from '@/lib/aiTools';

// ── Menu data (downloaders vs tools kept separate) ──────────────────
const downloaderExtras = [
  { label: 'All-in-One Downloader', href: '/video-downloader' },
  { label: 'Bulk Downloader', href: '/batch-video-downloader' },
];
const toolGroups = [
  { title: 'AI tools', items: AI_TOOL_LIST.map((t) => ({ label: t.name, href: `/${t.slug}` })) },
  { title: 'Thumbnail grabbers', items: IMAGE_TOOL_LIST.map((t) => ({ label: `${t.name} Downloader`, href: `/${t.slug}` })) },
  { title: 'Video converters', items: CONVERTER_LIST.map((t) => ({ label: t.name, href: `/${t.slug}` })) },
  { title: 'Extras', items: [{ label: 'Browser Extension', href: '/browser-extension' }] },
];

type OpenMenu = 'downloaders' | 'tools' | null;

export function Navbar() {
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState<OpenMenu>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/85 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-1 md:flex" ref={ref}>
          {/* Downloaders */}
          <div className="relative">
            <MenuButton label="Downloaders" isOpen={open === 'downloaders'} onClick={() => setOpen((o) => (o === 'downloaders' ? null : 'downloaders'))} />
            {open === 'downloaders' && (
              <Panel className="w-[32rem]">
                <SectionLabel>Video downloaders</SectionLabel>
                <div className="grid grid-cols-3 gap-1">
                  {PLATFORM_LIST.map((p) => (
                    <DropLink key={p.key} href={`/${p.slug}`} onNavigate={() => setOpen(null)}>
                      <PlatformIcon platform={p.key} color={p.brandColor} className="h-4 w-4 shrink-0" />
                      {p.name}
                    </DropLink>
                  ))}
                </div>
                <div className="my-2 h-px bg-surface-border" />
                {downloaderExtras.map((t) => (
                  <DropLink key={t.href} href={t.href} onNavigate={() => setOpen(null)}>
                    {t.label}
                  </DropLink>
                ))}
              </Panel>
            )}
          </div>

          {/* Tools */}
          <div className="relative">
            <MenuButton label="Tools" isOpen={open === 'tools'} onClick={() => setOpen((o) => (o === 'tools' ? null : 'tools'))} />
            {open === 'tools' && (
              <Panel className="w-[22rem]">
                {toolGroups.map((g) => (
                  <div key={g.title} className="mb-2 last:mb-0">
                    <SectionLabel>{g.title}</SectionLabel>
                    {g.items.map((t) => (
                      <DropLink key={t.href} href={t.href} onNavigate={() => setOpen(null)}>
                        {t.label}
                      </DropLink>
                    ))}
                  </div>
                ))}
                <div className="my-2 h-px bg-surface-border" />
                <Link
                  href="/tools"
                  onClick={() => setOpen(null)}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-accent transition-colors hover:bg-surface-soft"
                >
                  See all tools <span aria-hidden="true">→</span>
                </Link>
              </Panel>
            )}
          </div>

          {nav.primary.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink">
              {t.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
          aria-label={mobile ? 'Close menu' : 'Open menu'}
          aria-expanded={mobile}
          onClick={() => setMobile((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {mobile ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {mobile && (
        <div className="max-h-[80vh] overflow-y-auto border-t border-surface-border bg-surface md:hidden">
          <div className="container-page py-3">
            <SectionLabel>Video downloaders</SectionLabel>
            <div className="grid grid-cols-2 gap-1">
              {PLATFORM_LIST.map((p) => (
                <Link key={p.key} href={`/${p.slug}`} onClick={() => setMobile(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-soft hover:text-ink">
                  <PlatformIcon platform={p.key} color={p.brandColor} className="h-4 w-4 shrink-0" />
                  {p.name}
                </Link>
              ))}
            </div>
            {downloaderExtras.map((t) => (
              <Link key={t.href} href={t.href} onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-soft hover:text-ink">
                {t.label}
              </Link>
            ))}
            {toolGroups.map((g) => (
              <div key={g.title}>
                <SectionLabel>{g.title}</SectionLabel>
                {g.items.map((t) => (
                  <Link key={t.href} href={t.href} onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-soft hover:text-ink">
                    {t.label}
                  </Link>
                ))}
              </div>
            ))}
            <Link href="/tools" onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-accent hover:bg-surface-soft">
              See all tools →
            </Link>
            <div className="my-2 h-px bg-surface-border" />
            {nav.primary.map((t) => (
              <Link key={t.href} href={t.href} onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-base font-medium text-ink-muted hover:bg-surface-soft hover:text-ink">
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function MenuButton({ label, isOpen, onClick }: { label: string; isOpen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
    >
      {label}
      <svg className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute left-0 top-full mt-2 animate-fade-up rounded-xl border border-surface-border bg-surface p-3 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{children}</p>;
}

function DropLink({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
    >
      {children}
    </Link>
  );
}
