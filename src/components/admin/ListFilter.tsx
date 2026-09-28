'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

// Filters server-rendered children by DOM data-attributes rather than
// re-implementing the list — rows keep their real <form>/Server Action
// bindings, this just toggles [hidden] on matches. See data-search /
// data-category on each row, and data-group on each section wrapper.
export function ListFilter({
  searchPlaceholder,
  categories,
  children,
}: {
  searchPlaceholder: string;
  categories?: FilterOption[];
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const q = query.trim().toLowerCase();

    const rows = root.querySelectorAll<HTMLElement>('[data-search]');
    rows.forEach((el) => {
      const matchesText = !q || (el.dataset.search ?? '').includes(q);
      const matchesCategory = category === 'all' || !el.dataset.category || el.dataset.category === category;
      el.hidden = !(matchesText && matchesCategory);
    });

    const groups = root.querySelectorAll<HTMLElement>('[data-group]');
    groups.forEach((group) => {
      group.hidden = !group.querySelector('[data-search]:not([hidden])');
    });
  }, [query, category]);

  return (
    <div ref={ref}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full max-w-xs rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <CategoryPill active={category === 'all'} onClick={() => setCategory('all')}>
              All
            </CategoryPill>
            {categories.map((c) => (
              <CategoryPill key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                {c.label}
              </CategoryPill>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-accent text-accent-fg' : 'bg-surface-soft text-ink-muted hover:bg-surface-border'
      }`}
    >
      {children}
    </button>
  );
}
