import Link from 'next/link';
import { site } from '@/lib/site';

/** Wordmark — a 2x2 tile grid (many tools, one hub), echoing the "All tools" tab
 * icon elsewhere in the product. Deliberately abstract, not a play mark. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${site.name} home`} className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#2563EB" />
        <rect x="6" y="6" width="7" height="7" rx="2" fill="#fff" />
        <rect x="15" y="6" width="7" height="7" rx="2" fill="#fff" />
        <rect x="6" y="15" width="7" height="7" rx="2" fill="#fff" />
        <rect x="15" y="15" width="7" height="7" rx="2" fill="#fff" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-ink">
        Snap<span className="text-accent">Vidly</span>
      </span>
    </Link>
  );
}
