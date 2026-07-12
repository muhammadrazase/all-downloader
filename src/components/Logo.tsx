import Link from 'next/link';
import { site } from '@/lib/site';

/** Wordmark — inline SVG play mark (SnapVidly) + two-tone brand name. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${site.name} home`} className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#2563EB" />
        <path d="M11 9.2v9.6L18.5 14 11 9.2z" fill="#fff" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-ink">
        Snap<span className="text-accent">Vidly</span>
      </span>
    </Link>
  );
}
