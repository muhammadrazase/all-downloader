import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Steps } from '@/components/Steps';
import { FAQ } from '@/components/FAQ';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AdSlot } from '@/components/ads/AdSlot';
import { PLATFORM_LIST, getPlatformByKey, type PlatformKey } from '@/lib/platforms';
import { buildMetadata } from '@/lib/seo';
import { howToSchema, faqSchema, breadcrumbSchema } from '@/lib/schema';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return PLATFORM_LIST.map((p) => ({ platform: p.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const { platform } = await params;
  const p = getPlatformByKey(platform);
  if (!p) return {};
  return buildMetadata({
    title: `How to Download ${p.name} Videos (Mobile & PC) — Step by Step`,
    description: `A simple step-by-step guide to downloading ${p.name} videos on your phone and computer, free and without a watermark.`,
    path: `/how-to/${p.key}`,
  });
}

export default async function HowToPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const p = getPlatformByKey(platform);
  if (!p) notFound();

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'How-to', path: `/how-to/${p.key}` },
    { name: `Download ${p.name} videos`, path: `/how-to/${p.key}` },
  ];

  return (
    <>
      <JsonLd data={howToSchema(`How to download ${p.name} videos on mobile`, [...p.mobileSteps])} />
      <JsonLd data={faqSchema(p.faqs)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-ink sm:text-4xl">
          How to download {p.name} videos
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
          Save any public {p.name} video in HD on your phone or computer — free, no app, no watermark. Here’s exactly how.
        </p>
        <Link href={`/${p.slug}`} className="btn-accent mt-6">
          Open the {p.name} downloader
        </Link>
      </section>

      <section className="container-page py-10">
        <div className="grid gap-6 md:grid-cols-2">
          <Steps title="On mobile (iPhone & Android)" steps={p.mobileSteps} />
          <Steps title="On PC / laptop" steps={p.pcSteps} />
        </div>
      </section>

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={113} />
      </div>

      <section className="container-page py-14">
        <FAQ faqs={p.faqs} heading={`Downloading ${p.name} videos — FAQ`} />
      </section>

      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-12 text-center">
          <p className="text-ink-muted">
            Prefer to read more? Explore the{' '}
            <Link href={`/blog/${p.key}`} className="font-medium text-accent hover:text-accent-hover">
              {p.name} blog
            </Link>{' '}
            for tips and trends.
          </p>
        </div>
      </section>
    </>
  );
}
