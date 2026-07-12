import Link from 'next/link';
import { DownloaderBox } from '@/components/DownloaderBox';
import { PlatformGrid } from '@/components/PlatformGrid';
import { ToolsSection } from '@/components/ToolsSection';
import { InstallApp } from '@/components/InstallApp';
import { AdSlot } from '@/components/ads/AdSlot';
import { FAQ } from '@/components/FAQ';
import { JsonLd } from '@/components/JsonLd';
import { faqSchema } from '@/lib/schema';
import type { Faq } from '@/lib/platforms';

export const dynamic = 'force-static';

const homeFaqs: Faq[] = [
  { q: 'Is SnapVidly free?', a: 'Yes. Every downloader on SnapVidly is free with no signup, no app to install, and no limit on how many videos you save.' },
  { q: 'Which platforms are supported?', a: 'TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr — videos, Reels, clips and GIFs, on both mobile and desktop. You can also grab YouTube and TikTok thumbnails.' },
  { q: 'Do I need to install anything?', a: 'No. SnapVidly runs entirely in your browser. Paste a link and download — nothing to install.' },
  { q: 'Are downloads watermark-free?', a: 'Where the platform allows it (for example TikTok), SnapVidly fetches the clean source file with no watermark.' },
  { q: 'Is it safe to use?', a: 'Yes. We never ask for your login, we don’t store your videos, and downloads come directly from the platform’s own servers.' },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqSchema(homeFaqs)} />

      {/* Hero — minimal, whitespace-heavy, one clear action. */}
      <section className="relative overflow-hidden">
        {/* Subtle premium backdrop — soft accent glow + fine grid, not flat white. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-120px] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a08_1px,transparent_1px),linear-gradient(to_bottom,#0f172a08_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)]" />
        </div>
        <div className="container-page py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-soft px-3 py-1 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-success" /> Free · No signup · No watermark
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold text-ink sm:text-5xl">
            Download any social video, <span className="text-accent">instantly</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
            Save videos from TikTok, Instagram, YouTube, Facebook, X (Twitter), Reddit, Pinterest, Twitch and
            more in HD — free, fast, and watermark-free. Just paste a link. Works on mobile and PC.
          </p>

          <div className="mx-auto mt-9 max-w-2xl">
            <DownloaderBox autoFocus />
            <p className="mt-3 text-sm text-ink-faint">
              Paste any link above — we detect the platform automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Platform grid */}
      <section className="container-page py-6">
        <h2 className="sr-only">Choose a platform</h2>
        <PlatformGrid />
      </section>

      {/* How it works */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl">How it works</h2>
          <p className="mt-3 text-ink-muted">Three steps. No account, no waiting.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: '1', t: 'Copy the link', d: 'Tap Share on any video and copy its link.' },
            { n: '2', t: 'Paste it here', d: 'Drop the link in the box — we detect the platform for you.' },
            { n: '3', t: 'Download in HD', d: 'Pick your quality and the file saves straight to your device.' },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-lg font-bold text-accent">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl">{s.t}</h3>
              <p className="mt-2 text-ink-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* In-content ad — below the fold, content above and below (policy-safe, CLS-safe) */}
      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={111} />
      </div>

      {/* Trust / value props */}
      <section className="border-y border-surface-border bg-surface-soft">
        <div className="container-page grid gap-8 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Lightning fast', d: 'Direct downloads from the source CDN — no slow re-uploads.', icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z' },
            { t: 'No watermark', d: 'Clean source files wherever the platform allows it.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
            { t: 'Private & safe', d: 'No login required. We never store your videos.', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
            { t: 'Any device', d: 'Works in any browser on phone, tablet and desktop.', icon: 'M4 5h16v10H4zM2 19h20M9 19v2M15 19v2' },
          ].map((v) => (
            <div key={v.t}>
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d={v.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h3 className="text-lg">{v.t}</h3>
              <p className="mt-2 text-sm text-ink-muted">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The wider toolkit — revealed after the core flow + trust are established */}
      <ToolsSection />

      {/* Install as an app (PWA) */}
      <InstallApp />

      {/* FAQ */}
      <section className="container-page py-20">
        <FAQ faqs={homeFaqs} />
        <p className="mx-auto mt-10 max-w-prose text-center text-sm text-ink-muted">
          Learn more on the <Link href="/blog" className="font-medium text-accent hover:text-accent-hover">blog</Link> or
          join the <Link href="/community" className="font-medium text-accent hover:text-accent-hover">community</Link>.
        </p>
      </section>
    </>
  );
}
