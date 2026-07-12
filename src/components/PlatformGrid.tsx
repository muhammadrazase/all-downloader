import Link from 'next/link';
import { PLATFORM_LIST } from '@/lib/platforms';
import { PlatformIcon } from './PlatformIcon';

/** Grid of platform entry points — server-rendered, part of the internal-link mesh. */
export function PlatformGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {PLATFORM_LIST.map((p) => (
        <Link
          key={p.key}
          href={`/${p.slug}`}
          className="card group flex flex-col items-start gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
        >
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${p.brandColor}14` }}
          >
            <PlatformIcon platform={p.key} color={p.brandColor} className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-ink">{p.name}</p>
            <p className="mt-0.5 text-sm text-ink-muted transition-colors group-hover:text-accent">Downloader →</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
