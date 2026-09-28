'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ToolGroup, ToolItem } from './ToolsSection';
import { ToolGlyph, ALL_ICON } from './toolIcons';
import { slugifyLabel } from '@/lib/slug';
import { CATEGORY_SELECT_EVENT } from '@/lib/categoryEvent';

function ToolCard({ item }: { item: ToolItem }) {
  return (
    <Link
      href={item.href}
      className="card group flex items-start gap-3 p-3.5 transition-[transform,border-color,box-shadow] duration-150 ease-enter hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:duration-100"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition-[background-color,color,transform] duration-200 group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink transition-colors duration-200 group-hover:text-accent">{item.name}</span>
        {item.blurb && <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{item.blurb}</span>}
      </span>
    </Link>
  );
}

/** Tab-style category filter over the full tool grid. Every tool sits in the
 * initial server-rendered "All" view, so crawlers and no-JS visitors see all 41 —
 * JS only narrows what's visible, for a faster, scroll-light browse. */
export function ToolDirectoryGrid({ groups }: { groups: ToolGroup[] }) {
  const [active, setActive] = useState<string | null>(null); // null = "All"

  const selectBySlug = useCallback(
    (slug: string) => {
      const match = groups.find((g) => slugifyLabel(g.label) === slug);
      if (match) {
        setActive(slugifyLabel(match.label));
        document.getElementById('tools')?.scrollIntoView({ block: 'start' });
      }
    },
    [groups],
  );

  // Arriving fresh at "/#pdf-tools" from another page (a real navigation, so this
  // component just mounted) — read the hash once up front.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) selectBySlug(hash);
  }, [selectBySlug]);

  // Clicking a sidebar category while already on "/" — same route, so Next's
  // router never remounts this component or fires `hashchange`. See categoryEvent.ts.
  useEffect(() => {
    const onSelect = (e: Event) => selectBySlug((e as CustomEvent<string>).detail);
    window.addEventListener(CATEGORY_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(CATEGORY_SELECT_EVENT, onSelect);
  }, [selectBySlug]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const activeGroup = groups.find((g) => slugifyLabel(g.label) === active) ?? null;
  const visibleItems = activeGroup ? activeGroup.items : groups.flatMap((g) => g.items);

  return (
    <div id="tools" className="scroll-mt-20">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tool categories">
        <TabButton label="All" count={total} icon={ALL_ICON} isActive={active === null} onClick={() => setActive(null)} />
        {groups.map((g) => {
          const key = slugifyLabel(g.label);
          return (
            <TabButton
              key={key}
              label={g.label}
              count={g.items.length}
              icon={g.icon}
              badge={g.badge}
              isActive={active === key}
              onClick={() => setActive(active === key ? null : key)}
            />
          );
        })}
      </div>

      {activeGroup && <p className="mt-4 text-sm text-ink-muted">{activeGroup.description}</p>}

      <div
        key={active ?? 'all'}
        className="mt-5 grid animate-fade-up grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
        role="tabpanel"
        aria-live="polite"
      >
        {visibleItems.map((item) => (
          <ToolCard key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}

function TabButton({
  label,
  count,
  icon,
  badge,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  badge?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-200 active:scale-95 active:duration-100 ${
        isActive
          ? 'border-accent bg-accent text-white'
          : 'border-surface-border bg-surface text-ink-muted hover:border-accent/30 hover:text-ink'
      }`}
    >
      <ToolGlyph size={15}>{icon}</ToolGlyph>
      {label}
      <span className={isActive ? 'opacity-80' : 'text-ink-faint'}>{count}</span>
      {badge && !isActive && <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-bold text-accent">{badge}</span>}
    </button>
  );
}
