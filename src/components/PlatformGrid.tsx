import Link from 'next/link';
import { PLATFORM_LIST } from '@/lib/platforms';
import { filterVisible } from '@/lib/config/contentConfig';
import { PlatformIcon } from './PlatformIcon';

/** Grid of platform entry points — server-rendered, part of the internal-link mesh. */
export function PlatformGrid() {
  const platforms = filterVisible('platform', PLATFORM_LIST, (p) => p.key);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {platforms.map((p) => (
        <Link
          key={p.key}
          href={`/${p.slug}`}
          className="card group flex flex-col items-start gap-3 p-5 transition-[transform,border-color,box-shadow] duration-150 ease-enter hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:duration-100"
        >
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 ease-enter group-hover:scale-110"
            style={{ backgroundColor: `${p.brandColor}14` }}
          >
            <PlatformIcon platform={p.key} color={p.brandColor} className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-ink">{p.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted transition-colors duration-200 group-hover:text-accent">
              Downloader
              <span className="inline-block transition-transform duration-200 ease-enter group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
