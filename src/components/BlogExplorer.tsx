'use client';

import { useEffect, useMemo, useState } from 'react';
import { BlogCard } from './BlogCard';
import { CATEGORY_LABEL, type BlogCategory } from '@/lib/blogCategories';
import type { PostMeta } from '@/lib/blog';

type Sort = 'newest' | 'oldest';
type View = 'grid' | 'list';

const VIEW_KEY = 'sv:blogView';

function loadView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function BlogExplorer({ posts, categories }: { posts: PostMeta[]; categories: BlogCategory[] }) {
  const [category, setCategory] = useState<'all' | BlogCategory>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<View>('grid');

  // Read the persisted view preference after mount only — avoids a
  // server/client hydration mismatch, since localStorage isn't available server-side.
  useEffect(() => setView(loadView()), []);

  const setViewPersist = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private browsing or storage disabled — the toggle still works for this visit.
    }
  };

  const countByCategory = useMemo(() => {
    const counts = new Map<BlogCategory, number>();
    for (const p of posts) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, [posts]);

  const visible = useMemo(() => {
    const filtered = category === 'all' ? posts : posts.filter((p) => p.category === category);
    return [...filtered].sort((a, b) => (sort === 'newest' ? (a.date < b.date ? 1 : -1) : a.date < b.date ? -1 : 1));
  }, [posts, category, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-soft p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative">
            <span className="sr-only">Filter by category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'all' | BlogCategory)}
              className="appearance-none rounded-lg border border-surface-border bg-surface py-2 pl-3 pr-9 text-sm font-medium text-ink outline-none transition-colors duration-200 hover:border-accent/30 focus-visible:border-accent"
            >
              <option value="all">All categories · {posts.length}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]} · {countByCategory.get(c) ?? 0}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          </label>

          <label className="relative">
            <span className="sr-only">Sort order</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="appearance-none rounded-lg border border-surface-border bg-surface py-2 pl-3 pr-9 text-sm font-medium text-ink outline-none transition-colors duration-200 hover:border-accent/30 focus-visible:border-accent"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs text-ink-faint" aria-live="polite">
            {visible.length} article{visible.length === 1 ? '' : 's'}
          </p>
          <div role="group" aria-label="Layout" className="flex items-center rounded-lg border border-surface-border bg-surface p-0.5">
            <ViewButton active={view === 'grid'} label="Grid view" onClick={() => setViewPersist('grid')}>
              <GridGlyph />
            </ViewButton>
            <ViewButton active={view === 'list'} label="List view" onClick={() => setViewPersist('list')}>
              <ListGlyph />
            </ViewButton>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="animate-fade-up py-16 text-center text-ink-muted">No articles in this category yet. Check back soon.</p>
      ) : view === 'grid' ? (
        <div key={`grid-${category}-${sort}`} className="mt-6 grid animate-fade-up gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <BlogCard key={`${p.category}/${p.slug}`} post={p} variant="grid" />
          ))}
        </div>
      ) : (
        <div key={`list-${category}-${sort}`} className="mt-6 flex animate-fade-up flex-col gap-3">
          {visible.map((p) => (
            <BlogCard key={`${p.category}/${p.slug}`} post={p} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-[color,background-color,transform] duration-150 ease-enter active:scale-90 ${
        active ? 'bg-accent text-white' : 'text-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function ChevronDown({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function ListGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="3" rx="1" fill="currentColor" />
      <rect x="3" y="10.5" width="18" height="3" rx="1" fill="currentColor" />
      <rect x="3" y="16.5" width="18" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}
