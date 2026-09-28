'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Logo } from './Logo';
import { PlatformIcon } from './PlatformIcon';
import { toolGlyph, ToolGlyph, GROUP_ICON } from './toolIcons';
import { nav } from '@/lib/site';
import { slugifyLabel } from '@/lib/slug';
import { dispatchCategorySelect } from '@/lib/categoryEvent';
import type { PlatformKey } from '@/lib/platforms';

/** Same per-tool icon set as the homepage cards, at rail scale. */
const railIcon = (slug: string) => toolGlyph(slug, 16);

interface NamedLink {
  slug: string;
  name: string;
}
interface PlatformLink extends NamedLink {
  key: PlatformKey;
  brandColor: string;
}

export interface SidebarProps {
  platforms: PlatformLink[];
  aiTools: NamedLink[];
  converters: NamedLink[];
  imageTools: NamedLink[];
  pdfTools: NamedLink[];
  fileTools: NamedLink[];
}

interface LinkItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}
interface Group {
  title: string;
  icon: React.ReactNode;
  items: LinkItem[];
}

/** Site-wide nav: a persistent rail on desktop, an off-canvas drawer on mobile.
 * Every category, "Downloaders" included, renders through the same list and style. */
export function Sidebar({ platforms, aiTools, converters, imageTools, pdfTools, fileTools, mobileOpen, onCloseMobile }: SidebarProps & { mobileOpen: boolean; onCloseMobile: () => void }) {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseMobile();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen, onCloseMobile]);

  const groups: Group[] = [
    {
      title: 'Downloaders',
      icon: GROUP_ICON['Downloaders'],
      items: [
        // No brandColor here on purpose — Downloaders reads like every other category, not a louder one.
        ...platforms.map((p) => ({ label: p.name, href: `/${p.slug}`, icon: <PlatformIcon platform={p.key} className="h-4 w-4 shrink-0" /> })),
        { label: 'All-in-One Downloader', href: '/video-downloader', icon: railIcon('video-downloader') },
        { label: 'Bulk Downloader', href: '/batch-video-downloader', icon: railIcon('batch-video-downloader') },
      ],
    },
    { title: 'AI video tools', icon: GROUP_ICON['AI video tools'], items: aiTools.map((t) => ({ label: t.name, href: `/${t.slug}`, icon: railIcon(t.slug) })) },
    { title: 'Video converters', icon: GROUP_ICON['Video converters'], items: converters.map((t) => ({ label: t.name, href: `/${t.slug}`, icon: railIcon(t.slug) })) },
    { title: 'Thumbnail grabbers', icon: GROUP_ICON['Thumbnail grabbers'], items: imageTools.map((t) => ({ label: `${t.name} Downloader`, href: `/${t.slug}`, icon: railIcon(t.slug) })) },
    { title: 'PDF tools', icon: GROUP_ICON['PDF tools'], items: pdfTools.map((t) => ({ label: t.name, href: `/${t.slug}`, icon: railIcon(t.slug) })) },
    { title: 'File & image tools', icon: GROUP_ICON['File & image tools'], items: fileTools.map((t) => ({ label: t.name, href: `/${t.slug}`, icon: railIcon(t.slug) })) },
    { title: 'Extras', icon: GROUP_ICON['Extras'], items: [{ label: 'Browser Extension', href: '/browser-extension', icon: railIcon('browser-extension') }] },
  ];

  return (
    <>
      {/* Desktop persistent rail */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-surface-border md:block">
        <SidebarBody groups={groups} />
      </aside>

      {/* Mobile off-canvas drawer — always mounted so open/close can transition;
          `pointer-events-none` when closed so the invisible overlay can't block clicks underneath. */}
      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={onCloseMobile}
        />
        <div
          inert={!mobileOpen}
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-lg transition-transform duration-300 ease-enter ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border px-4">
            <Logo />
            <button
              type="button"
              aria-label="Close menu"
              onClick={onCloseMobile}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarBody groups={groups} onNavigate={onCloseMobile} />
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarBody({ groups, onNavigate }: { groups: Group[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();

  const results = term
    ? groups.flatMap((g) => g.items.filter((t) => t.label.toLowerCase().includes(term)).map((t) => ({ ...t, groupTitle: g.title })))
    : [];

  return (
    <nav className="flex flex-col p-3" aria-label="Tools">
      <Link
        href="/contact?type=suggestion#suggestion-form"
        onClick={onNavigate}
        className="mb-3 flex items-center gap-2.5 rounded-lg bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent hover:text-white"
      >
        <SidebarGlyph>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" />
        </SidebarGlyph>
        Suggest a tool
      </Link>

      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint">
          <SidebarGlyph>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </SidebarGlyph>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a tool…"
          aria-label="Find a tool"
          autoComplete="off"
          className="w-full rounded-lg border border-surface-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors focus:border-accent"
        />
      </div>

      {term ? (
        <div className="space-y-0.5" role="list" aria-label={`Tools matching "${query.trim()}"`}>
          {results.length === 0 && <p className="px-2.5 py-2 text-sm text-ink-faint">No tool matches “{query.trim()}”.</p>}
          {results.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors duration-200 hover:bg-surface-soft hover:text-ink"
            >
              {t.icon}
              <span className="min-w-0 flex-1 truncate">{t.label}</span>
              <span className="shrink-0 text-xs text-ink-faint">{t.groupTitle}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-0.5">
            {groups.map((g) => {
              const active = g.items.some((t) => t.href === pathname);
              const slug = slugifyLabel(g.title);
              return (
                <Link
                  key={g.title}
                  href={`/#${slug}`}
                  onClick={() => {
                    // Covers the same-page case (already on "/") where a hash-only
                    // link click updates the URL but Next's router never remounts
                    // or fires hashchange — see categoryEvent.ts.
                    dispatchCategorySelect(slug);
                    onNavigate?.();
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200 ${
                    active ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-muted hover:bg-surface-soft hover:text-ink'
                  }`}
                >
                  <ToolGlyph size={16}>{g.icon}</ToolGlyph>
                  <span className="min-w-0 flex-1 truncate">{g.title}</span>
                  <span className={`shrink-0 text-xs ${active ? 'text-accent/70' : 'text-ink-faint'}`}>{g.items.length}</span>
                </Link>
              );
            })}
          </div>

          <div className="border-t border-surface-border pt-4">
            <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">More</p>
            <div className="space-y-0.5">
              {nav.primary.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={onNavigate}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors duration-200 hover:bg-surface-soft hover:text-ink"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function SidebarGlyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}
