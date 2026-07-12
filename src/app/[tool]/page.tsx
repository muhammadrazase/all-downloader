import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DownloaderBox } from '@/components/DownloaderBox';
import { PlatformIcon } from '@/components/PlatformIcon';
import { AdSlot } from '@/components/ads/AdSlot';
import { RelatedOffers } from '@/components/RelatedOffers';
import { FAQ } from '@/components/FAQ';
import { Steps } from '@/components/Steps';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { PLATFORM_LIST, getPlatformBySlug } from '@/lib/platforms';
import { buildMetadata } from '@/lib/seo';
import {
  webApplicationSchema,
  faqSchema,
  howToSchema,
  breadcrumbSchema,
} from '@/lib/schema';

// SSG: only the 5 tool slugs are generated; anything else 404s.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return PLATFORM_LIST.map((p) => ({ tool: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const p = getPlatformBySlug(tool);
  if (!p) return {};
  return buildMetadata({
    title: p.metaTitle,
    description: p.metaDescription,
    path: `/${p.slug}`,
    keywords: [
      p.keyword,
      `${p.name} downloader`,
      `${p.name} video downloader`,
      `download ${p.name} videos`,
      `${p.name} downloader online`,
      `save ${p.name} video`,
      'no watermark',
      'HD',
      'MP4',
      'MP3',
    ],
  });
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const p = getPlatformBySlug(tool);
  if (!p) notFound();

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: `${p.name} Downloader`, path: `/${p.slug}` },
  ];

  return (
    <>
      <JsonLd data={webApplicationSchema(p.metaTitle, `/${p.slug}`, p.metaDescription)} />
      <JsonLd data={faqSchema(p.faqs)} />
      <JsonLd data={howToSchema(`How to download ${p.name} videos`, [...p.pcSteps])} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      {/* Hero + tool */}
      <section className="container-page py-10 text-center sm:py-14">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${p.brandColor}14` }}>
          <PlatformIcon platform={p.key} color={p.brandColor} className="h-7 w-7" />
        </div>
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-ink sm:text-4xl">{p.h1}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">{p.intro}</p>

        <div className="mx-auto mt-8 max-w-2xl">
          <DownloaderBox platformKey={p.key} autoFocus />
          <p className="mt-3 text-sm text-ink-faint">Example: {p.urlExample}</p>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.features.map((f) => (
            <div key={f.title} className="card p-5">
              <h2 className="text-lg">{f.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ad slot — 300×250 works on mobile + desktop; CLS-safe; only renders
          when a network is configured. */}
      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={101} context="downloader" />
      </div>

      {/* How-to: mobile + PC */}
      <section className="container-page py-12">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl">How to download {p.name} videos</h2>
          <p className="mt-3 text-ink-muted">Works the same on phone and computer — here’s both.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Steps title="On mobile (iPhone & Android)" steps={p.mobileSteps} />
          <Steps title="On PC / laptop" steps={p.pcSteps} />
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page py-16">
        <FAQ faqs={p.faqs} heading={`${p.name} downloader — FAQ`} />
      </section>

      {/* Second in-content ad — after substantial content (steps + FAQ), policy-safe */}
      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={115} context="downloader" />
      </div>

      {/* Contextual affiliate offers — the primary, ad-block-proof revenue lane.
          Renders nothing until offers are configured; VPN/editor offers surface
          first on the platforms tagged for them. */}
      <RelatedOffers context="downloader" platform={p.key} heading={`Do more with your ${p.name} videos`} />

      {/* Related tools — internal-link mesh */}
      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-14">
          <h2 className="text-center text-2xl">Download from other platforms</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {PLATFORM_LIST.filter((o) => o.key !== p.key).map((o) => (
              <Link key={o.key} href={`/${o.slug}`} className="btn-ghost">
                {o.name} Downloader
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-ink-muted">
            New to this? Read the{' '}
            <Link href={`/how-to/${p.key}`} className="font-medium text-accent hover:text-accent-hover">
              full {p.name} download guide
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
