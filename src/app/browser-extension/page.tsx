import Link from 'next/link';
import type { Metadata } from 'next';
import { InstallExtensionCTA } from '@/components/InstallExtensionCTA';
import { FAQ } from '@/components/FAQ';
import { Steps } from '@/components/Steps';
import { JsonLd } from '@/components/JsonLd';
import { buildMetadata } from '@/lib/seo';
import { faqSchema } from '@/lib/schema';
import { site } from '@/lib/site';
import type { Faq } from '@/lib/platforms';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'SnapVidly for Chrome — One-Click Video Downloader Extension',
  description:
    'Free Chrome extension to download videos in one click. A button appears on TikTok, YouTube, Instagram, X and more — click to download. No signup, no watermark.',
  path: '/browser-extension',
  keywords: ['chrome video downloader extension', 'video downloader chrome extension', 'chrome extension download video', 'one click video download chrome', 'download video from any site chrome', 'chrome extension to save videos', 'one click video downloader', 'snapvidly chrome extension'],
});

const installSteps = [
  'Click “Add to Chrome”, then confirm “Add extension”.',
  'Pin SnapVidly to your toolbar (click the puzzle icon → pin).',
  'That’s it — you’re ready to download.',
];

const useSteps = [
  'Open any video on TikTok, YouTube, Instagram, X and more.',
  'A “⬇ SnapVidly” button appears on the page.',
  'Click it — SnapVidly opens with the video ready.',
  'Pick a quality (HD, 4K or MP3) and download.',
];

const features = [
  { t: 'Button on every video', b: 'A download button appears right on the video page — no copy-pasting links.' },
  { t: 'One-click download', b: 'Click once and SnapVidly opens with the video already loaded and extracting.' },
  { t: 'Works on 11+ sites', b: 'TikTok, YouTube, Instagram, Facebook, X, Reddit, Pinterest, Vimeo, Twitch and more.' },
  { t: 'Private & free', b: 'Only reads the current tab’s URL when you click. No tracking, no signup, no watermark.' },
];

const faqs: Faq[] = [
  { q: 'How do I add the SnapVidly extension to Chrome?', a: 'Click “Add to Chrome” above, then confirm “Add extension” in the popup. Pin it to your toolbar and you’re done — see the steps below.' },
  { q: 'Is the Chrome extension free?', a: 'Yes — completely free, no signup, no account, no watermark.' },
  { q: 'How does one-click download work?', a: 'On a supported video page a “⬇ SnapVidly” button appears. Clicking it opens SnapVidly with that video’s link already loaded, so extraction starts automatically.' },
  { q: 'Which sites does it work on?', a: 'TikTok, YouTube, Instagram, Facebook, X (Twitter), Reddit, Pinterest, Vimeo, Twitch, Tumblr and LinkedIn. The button only shows on actual video pages.' },
  { q: 'Is it safe? What permissions does it use?', a: 'It only uses the “active tab” permission — it reads the current tab’s URL when you click the button, nothing more. It doesn’t track you, run in the background, or download anything itself.' },
  { q: 'Does it work in Brave, Edge and Opera?', a: 'Yes. It works in Chrome and all Chromium-based browsers (Brave, Edge, Opera) — install it from the Chrome Web Store.' },
];

export default function ExtensionPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'SnapVidly for Chrome',
          applicationCategory: 'BrowserApplication',
          operatingSystem: 'Chrome',
          url: `${site.url}/browser-extension`,
          ...(site.chromeExtensionUrl ? { downloadUrl: site.chromeExtensionUrl, installUrl: site.chromeExtensionUrl } : {}),
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '640' },
        }}
      />
      <JsonLd data={faqSchema(faqs)} />

      {/* Hero + primary CTA */}
      <section className="container-page py-14 text-center sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-soft px-3 py-1 text-sm font-medium text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-success" /> Chrome extension · free
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold text-ink sm:text-5xl">
          Download videos in <span className="text-accent">one click</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
          Add SnapVidly to Chrome and a download button appears right on TikTok, YouTube, Instagram, X and more. No
          copy-pasting links — just click and save.
        </p>
        <div className="mt-8">
          <InstallExtensionCTA />
        </div>
      </section>

      {/* Why use it */}
      <section className="container-page py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.t} className="card p-5">
              <h2 className="text-lg">{f.t}</h2>
              <p className="mt-2 text-sm text-ink-muted">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install + use, side by side */}
      <section className="container-page py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl">Get started in seconds</h2>
          <p className="mt-3 text-ink-muted">Install once, then download from any page with a single click.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Steps title="1 · Install the extension" steps={installSteps} />
          <Steps title="2 · Download any video" steps={useSteps} />
        </div>
      </section>

      <section className="container-page py-14">
        <FAQ faqs={faqs} heading="Chrome extension — FAQ" />
      </section>

      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-12 text-center">
          <p className="text-ink-muted">
            Prefer not to install anything? You can always paste a link on the{' '}
            <Link href="/video-downloader" className="font-medium text-accent hover:text-accent-hover">
              all-in-one downloader
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
