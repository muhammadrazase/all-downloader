import Link from 'next/link';
import { getFeaturedOffer, type OfferContext } from '@/lib/offers';
import { AD_SIZE, type BannerPlacement } from '@/lib/ads';

/**
 * House ad — fills UNSOLD ad inventory (which, for a new site in this niche, is
 * most of it) instead of leaving a paid slot blank. Two tiers, best first:
 *
 *   1. A configured affiliate offer → real revenue, labeled "Sponsored".
 *   2. First-party promo for the browser extension → drives our most durable
 *      asset (installs survive ad blockers, SEO shifts, and platform changes).
 *      Always available (internal link), so a slot is never wasted.
 *
 * Keeps the same reserved footprint as a paid banner, so swapping in causes no
 * layout shift (CLS-safe). Pure first-party render — no third-party script, so
 * unlike a network banner it needs no lazy-loading and no "Advertisement" label
 * on the first-party variant (labeling our own promo as an ad would mislead).
 */
export function HouseAd({
  placement,
  context,
  className = '',
}: {
  placement: BannerPlacement;
  context: OfferContext;
  className?: string;
}) {
  const offer = getFeaturedOffer(context);
  const { w, h } = AD_SIZE[placement];

  return (
    <div className={`my-8 flex flex-col items-center ${className}`}>
      {offer && (
        <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">Sponsored</span>
      )}
      <div
        className="mx-auto w-full overflow-hidden rounded-xl border border-surface-border bg-surface-soft"
        style={{ minHeight: h, maxWidth: w }}
      >
        {offer ? (
          <a
            href={offer.url}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="group flex h-full flex-col justify-center gap-1 p-4 text-center"
            style={{ minHeight: h }}
          >
            <span className="text-base font-semibold text-ink">{offer.name}</span>
            <span className="text-sm leading-snug text-ink-muted">{offer.tagline}</span>
            <span className="mt-2 inline-flex items-center justify-center gap-1 text-sm font-semibold text-accent group-hover:text-accent-hover">
              {offer.cta} <Arrow />
            </span>
          </a>
        ) : (
          <Link
            href="/browser-extension"
            className="group flex h-full flex-col items-center justify-center gap-1 p-4 text-center"
            style={{ minHeight: h }}
          >
            <span className="text-base font-semibold text-ink">Get the SnapVidly extension</span>
            <span className="text-sm leading-snug text-ink-muted">Download any video in one click — no copy-paste.</span>
            <span className="mt-2 inline-flex items-center justify-center gap-1 text-sm font-semibold text-accent group-hover:text-accent-hover">
              Add to your browser <Arrow />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
