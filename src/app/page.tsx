import Link from 'next/link';
import { DownloaderBox } from '@/components/DownloaderBox';
import { ToolDirectory } from '@/components/ToolsSection';
import { InstallApp } from '@/components/InstallApp';
import { AdSlot } from '@/components/ads/AdSlot';
import { FAQ } from '@/components/FAQ';
import { JsonLd } from '@/components/JsonLd';
import { faqSchema } from '@/lib/schema';
import type { Faq } from '@/lib/platforms';

export const dynamic = 'force-static';

const homeFaqs: Faq[] = [
  { q: 'Is SnapVidly free?', a: 'Yes. All 44 tools are free with no signup, no app to install, and no limit on how much you use them.' },
  { q: 'What can I do besides download videos?', a: 'Turn any video into text or a summary with AI, convert or trim video and audio, merge or split PDFs, compress images, generate QR codes and more — the full list is on the homepage, grouped by category.' },
  { q: 'Which platforms are supported for downloads?', a: 'TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr. Save videos, Reels, clips and GIFs on both mobile and desktop. You can also grab YouTube and TikTok thumbnails.' },
  { q: 'Do I need to install anything?', a: 'No. Every tool runs in your browser — paste a link or drop in a file, and nothing to install.' },
  { q: 'Are downloads watermark-free?', a: 'Where the platform allows it (for example TikTok), SnapVidly fetches the clean source file with no watermark.' },
  { q: 'Is it safe to use?', a: 'Yes. We never ask you to log in, and we don’t store what you upload, paste or download. Video downloads come directly from the platform’s own servers, and tools like our PDF and file converters run entirely in your browser.' },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqSchema(homeFaqs)} />

      {/* Hero — compact on purpose: the tool directory below is the point, not a full-height banner. */}
      <section className="relative overflow-hidden">
        {/* Subtle premium backdrop — soft accent glow + fine grid, not flat white. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-120px] h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a08_1px,transparent_1px),linear-gradient(to_bottom,#0f172a08_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)]" />
        </div>
        <div className="container-page py-10 text-center sm:py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-soft px-3 py-1 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-success" /> Free · 40+ tools · No signup
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold text-ink sm:text-5xl">
            One free hub for video, PDF and file tools
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink-muted">
            Download from TikTok, Instagram, YouTube and more. Then convert, transcribe or edit it, and use a full
            set of PDF and file tools too. No signup, no watermark.
          </p>

          <div className="mx-auto mt-7 max-w-2xl">
            <DownloaderBox autoFocus />
            <p className="mt-2.5 text-sm text-ink-faint">Paste any link, or browse every tool below.</p>
          </div>
        </div>
      </section>

      {/* The full tool catalog, right after the hero — this is a tools hub, not a single-purpose page */}
      <section className="container-page pb-14" aria-labelledby="toolkit-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="toolkit-heading" className="text-3xl">Every tool, right here</h2>
          <p className="mt-2 text-ink-muted">Filter by category or browse everything. Nothing else to click through to.</p>
        </div>
        <div className="mt-8">
          <ToolDirectory />
        </div>
      </section>

      {/* How it works — the pattern every tool shares, not just downloading */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl">How it works</h2>
          <p className="mt-3 text-ink-muted">Three steps, whichever of the 44 tools you need. No account, no waiting.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: '1', t: 'Pick a tool', d: 'A downloader, a converter, a PDF tool, whatever the job needs.' },
            { n: '2', t: 'Add your link or file', d: 'Paste a link or drop in a file. Nothing to install.' },
            { n: '3', t: 'Get your result', d: 'Download or copy the result straight away.' },
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

      {/* Trust / value props — true across the whole hub, not just the downloaders */}
      <section className="border-y border-surface-border bg-surface-soft">
        <div className="container-page grid gap-8 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Fast by design', d: 'Most tools run right in your browser; downloads come straight from the source.', icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z' },
            { t: 'No signup, ever', d: 'Every one of the 44 tools is free to use, with no account and no limits.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
            { t: 'Private by default', d: 'Nothing you paste or upload is stored. Ever.', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
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
