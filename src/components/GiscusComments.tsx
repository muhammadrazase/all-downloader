'use client';

import { useEffect, useRef } from 'react';
import { site } from '@/lib/site';

/**
 * Giscus (GitHub Discussions) — our zero-database community layer.
 * Renders only when configured; otherwise shows a friendly placeholder so the
 * page never looks broken during setup.
 */
export function GiscusComments() {
  const ref = useRef<HTMLDivElement>(null);
  const configured = Boolean(site.giscus.repo && site.giscus.repoId && site.giscus.categoryId);

  useEffect(() => {
    if (!configured || !ref.current || ref.current.querySelector('script')) return;
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', site.giscus.repo);
    script.setAttribute('data-repo-id', site.giscus.repoId);
    script.setAttribute('data-category', site.giscus.category);
    script.setAttribute('data-category-id', site.giscus.categoryId);
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-loading', 'lazy');
    ref.current.appendChild(script);
  }, [configured]);

  if (!configured) {
    return (
      <div className="card p-8 text-center text-ink-muted">
        <p className="font-medium text-ink">Discussion board is being set up.</p>
        <p className="mt-2 text-sm">
          In the meantime, join us on Discord or Telegram above — we’d love to have you.
        </p>
      </div>
    );
  }

  return <div ref={ref} />;
}
