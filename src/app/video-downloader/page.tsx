import Link from 'next/link';
import type { Metadata } from 'next';
import { DownloaderBox } from '@/components/DownloaderBox';
import { PlatformGrid } from '@/components/PlatformGrid';
import { FAQ } from '@/components/FAQ';
import { Steps } from '@/components/Steps';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AdSlot } from '@/components/ads/AdSlot';
import { buildMetadata } from '@/lib/seo';
import { webApplicationSchema, faqSchema, howToSchema, breadcrumbSchema } from '@/lib/schema';
import type { Faq } from '@/lib/platforms';

export const dynamic = 'force-static';

const KEYWORD = 'video downloader';

export const metadata: Metadata = buildMetadata({
  title: 'All-in-One Video Downloader — Free Online, No Watermark, HD',
  description:
    'Free all-in-one video downloader for TikTok, Instagram, YouTube, Facebook, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and more. Download any social media video online in HD — no app, no signup, no watermark.',
  path: '/video-downloader',
  keywords: [
    'video downloader',
    'online video downloader',
    'free video downloader',
    'all in one video downloader',
    'social media video downloader',
    'download video from url',
    'video downloader online',
    'no watermark',
    'HD',
    'MP4',
    'MP3',
  ],
});

const faqs: Faq[] = [
  { q: 'What is an all-in-one video downloader?', a: 'It’s a single online tool that downloads videos from many platforms — TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr — instead of needing a separate app for each. Paste any link and SnapVidly detects the platform automatically.' },
  { q: 'Is this video downloader free?', a: 'Yes. It’s completely free with no signup, no app to install, and no limit on how many videos you download.' },
  { q: 'Can I download videos in HD or 4K?', a: 'Yes. You can choose the quality — from 360p up to 1080p and 4K where the source supports it — or extract MP3 audio.' },
  { q: 'Does it work on mobile and PC?', a: 'Yes. The downloader runs in any browser on iPhone, Android, Windows and Mac — nothing to install.' },
  { q: 'How do I download a video from a URL?', a: 'Copy the video’s share link, paste it into the box above, press Download, and choose your quality. The file saves straight to your device.' },
];

const steps = [
  'Copy the link of any video — TikTok, Instagram, YouTube, X, Reddit, Pinterest, Vimeo, Twitch and more.',
  'Paste it into the box above — the platform is detected automatically.',
  'Press Download and pick your quality (HD, 4K or MP3).',
  'The video saves directly to your phone or computer.',
];

export default function VideoDownloaderPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Video Downloader', path: '/video-downloader' },
  ];

  return (
    <>
      <JsonLd data={webApplicationSchema('All-in-One Video Downloader', '/video-downloader', metadata.description as string)} />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd data={howToSchema('How to download any video online', steps)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center sm:py-14">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-ink sm:text-4xl">
          All-in-One Video Downloader
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
          One free online tool to download videos from every major platform. Paste any {KEYWORD} link — TikTok,
          Instagram, YouTube, Facebook or LinkedIn — and save it in HD, without a watermark. Works on mobile and PC.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <DownloaderBox autoFocus />
          <p className="mt-3 text-sm text-ink-faint">Paste any link — we detect the platform automatically.</p>
        </div>
      </section>

      <section className="container-page py-6">
        <h2 className="sr-only">Supported platforms</h2>
        <PlatformGrid />
      </section>

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={105} />
      </div>

      <section className="container-page py-12">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl">How to download any video online</h2>
          <p className="mt-3 text-ink-muted">Three steps, any platform, any device.</p>
        </div>
        <div className="mx-auto max-w-2xl">
          <Steps title="Download in seconds" steps={steps} />
        </div>
      </section>

      <section className="container-page py-12">
        <div className="mx-auto max-w-prose">
          <h2 className="text-2xl">Why use an all-in-one downloader?</h2>
          <p className="mt-4 text-ink-muted">
            Instead of hunting for a separate app for every network, one tool handles them all. SnapVidly fetches the
            original file directly from the platform’s servers, so you get full quality with no watermark — and
            because nothing installs, it’s safe and works the same on every device.
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        <FAQ faqs={faqs} heading="Video downloader — FAQ" />
      </section>

      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-14 text-center">
          <h2 className="text-2xl">Download from a specific platform</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">Prefer a dedicated tool? Pick your platform:</p>
          <div className="mt-8">
            <PlatformGrid />
          </div>
          <p className="mt-8 text-sm text-ink-muted">
            New here? Read the <Link href="/blog" className="font-medium text-accent hover:text-accent-hover">blog</Link> for
            step-by-step guides.
          </p>
        </div>
      </section>
    </>
  );
}
