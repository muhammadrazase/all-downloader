import { getOffers, type OfferContext } from '@/lib/offers';
import type { PlatformKey } from '@/lib/platforms';

/**
 * Native, contextual affiliate strip — the primary revenue lane for a downloader
 * audience (ad-block-proof, high intent). Server component: offer URLs are
 * build-time env and there's no interactivity, so this adds ZERO client JS.
 *
 * Renders NOTHING until offers are configured, so it never ships an empty or
 * placeholder block. Links are rel="sponsored nofollow" and the section is
 * clearly labeled — required by Google's paid-link policy and honest to users.
 */
export function RelatedOffers({
  context,
  platform,
  heading = 'Recommended tools',
  limit = 3,
}: {
  context: OfferContext;
  platform?: PlatformKey;
  heading?: string;
  limit?: number;
}) {
  const offers = getOffers(context, { limit, platform });
  if (!offers.length) return null;

  return (
    <section className="container-page py-12" aria-label="Recommended partner tools">
      <div className="mx-auto mb-6 max-w-2xl text-center">
        <h2 className="text-2xl">{heading}</h2>
        <p className="mt-2 text-sm text-ink-faint">Hand-picked partners · we may earn a commission</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <a
            key={offer.id}
            href={offer.url}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="card group flex flex-col p-5 transition-shadow duration-200 hover:shadow-md focus-visible:shadow-md"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Sponsored</span>
            <h3 className="mt-1 text-lg text-ink">{offer.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{offer.tagline}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors group-hover:text-accent-hover">
              {offer.cta}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
