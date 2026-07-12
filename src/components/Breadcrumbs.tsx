import Link from 'next/link';

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.path} className="flex items-center gap-1.5">
              {last ? (
                <span className="text-ink" aria-current="page">
                  {it.name}
                </span>
              ) : (
                <Link href={it.path} className="hover:text-accent">
                  {it.name}
                </Link>
              )}
              {!last && <span className="text-ink-faint">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
