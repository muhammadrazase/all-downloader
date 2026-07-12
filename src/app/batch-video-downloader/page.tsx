import Link from 'next/link';
import type { Metadata } from 'next';
import { BatchDownloaderBox } from '@/components/BatchDownloaderBox';
import { FAQ } from '@/components/FAQ';
import { Steps } from '@/components/Steps';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AdSlot } from '@/components/ads/AdSlot';
import { buildMetadata } from '@/lib/seo';
import { webApplicationSchema, faqSchema, howToSchema, breadcrumbSchema } from '@/lib/schema';
import type { Faq } from '@/lib/platforms';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Bulk Video Downloader — Download Multiple Videos at Once (Free)',
  description:
    'Download multiple videos at once with SnapVidly’s bulk video downloader. Paste up to 20 links from TikTok, YouTube, Instagram, X and more — fetch them all in one go. Free, no signup.',
  path: '/batch-video-downloader',
  keywords: ['bulk video downloader', 'batch video downloader', 'download multiple videos', 'mass video downloader', 'download videos in bulk'],
});

const faqs: Faq[] = [
  { q: 'How many videos can I download at once?', a: 'Up to 20 links per batch. Paste one link per line, click Fetch all, and each video is prepared with its quality options.' },
  { q: 'Which platforms work in bulk?', a: 'Any platform SnapVidly supports — TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr — mixed together in one batch.' },
  { q: 'Is bulk downloading free?', a: 'Yes, completely free with no signup. Please only download content you own or have permission to use.' },
  { q: 'Why did one link fail while others worked?', a: 'Each link is handled independently. A private, removed or unsupported link shows an error on its own row while the rest continue.' },
];

const steps = [
  'Copy the links you want — one from each video.',
  'Paste them into the box above, one per line (up to 20).',
  'Click “Fetch all” — each video loads with its quality options.',
  'Download each one, or use “Download all” for the best quality of every video.',
];

export default function BatchPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Bulk Video Downloader', path: '/batch-video-downloader' },
  ];
  return (
    <>
      <JsonLd data={webApplicationSchema('Bulk Video Downloader', '/batch-video-downloader', metadata.description as string)} />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd data={howToSchema('How to download multiple videos at once', steps)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center sm:py-14">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-ink sm:text-4xl">
          Bulk Video Downloader — Many Videos, One Click
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
          Paste up to 20 links from any supported platform and fetch them all at once. Mix TikTok, YouTube, Instagram,
          X, Reddit and more in a single batch — free, no signup, no app.
        </p>
        <div className="mx-auto mt-8 max-w-2xl text-left">
          <BatchDownloaderBox />
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Up to 20 at once', b: 'Paste a whole list — no downloading one by one.' },
            { t: 'Any platform, mixed', b: 'TikTok, YouTube, X, Reddit, Vimeo and more in one batch.' },
            { t: 'Per-video quality', b: 'Each result shows HD/4K/MP3 options you can pick.' },
            { t: 'Free & private', b: 'No signup, no account, nothing stored.' },
          ].map((f) => (
            <div key={f.t} className="card p-5">
              <h2 className="text-lg">{f.t}</h2>
              <p className="mt-2 text-sm text-ink-muted">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={107} />
      </div>

      <section className="container-page py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl">How to download videos in bulk</h2>
        </div>
        <div className="mx-auto max-w-2xl">
          <Steps title="Step by step" steps={steps} />
        </div>
      </section>

      <section className="container-page py-14">
        <FAQ faqs={faqs} heading="Bulk downloader — FAQ" />
      </section>

      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-12 text-center">
          <p className="text-ink-muted">
            Need just one? Use the{' '}
            <Link href="/video-downloader" className="font-medium text-accent hover:text-accent-hover">
              all-in-one video downloader
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
