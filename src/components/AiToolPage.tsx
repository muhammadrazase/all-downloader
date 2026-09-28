import Link from 'next/link';
import { AiToolBox } from './AiToolBox';
import { FAQ } from './FAQ';
import { Steps } from './Steps';
import { Breadcrumbs } from './Breadcrumbs';
import { JsonLd } from './JsonLd';
import { TrackView } from './TrackView';
import { AdSlot } from './ads/AdSlot';
import { RelatedOffers } from './RelatedOffers';
import type { AiTool } from '@/lib/aiTools';
import { webApplicationSchema, faqSchema, howToSchema, breadcrumbSchema } from '@/lib/schema';

export function AiToolPage({ tool }: { tool: AiTool }) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: tool.name, path: `/${tool.slug}` },
  ];
  return (
    <>
      <TrackView tool={tool.slug} />
      <JsonLd data={webApplicationSchema(tool.metaTitle, `/${tool.slug}`, tool.metaDescription)} />
      <JsonLd data={faqSchema(tool.faqs)} />
      <JsonLd data={howToSchema(`How to use ${tool.name.toLowerCase()}`, tool.steps)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-soft px-3 py-1 text-sm font-medium text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-accent" /> AI-powered · free
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold text-ink sm:text-5xl">{tool.h1}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">{tool.intro}</p>
        <div className="mx-auto mt-8 max-w-2xl text-left">
          <AiToolBox tool={tool.toolType} />
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tool.features.map((f) => (
            <div key={f.title} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="mt-4 text-lg">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={110} context="ai" />
      </div>

      <section className="container-page py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl">How it works</h2>
        </div>
        <div className="mx-auto max-w-2xl">
          <Steps title="Step by step" steps={tool.steps} />
        </div>
      </section>

      <section className="container-page py-14">
        <FAQ faqs={tool.faqs} heading={`${tool.name} — FAQ`} />
        <p className="mx-auto mt-8 max-w-2xl text-center text-ink-muted">
          Read the guide:{' '}
          <Link href={tool.relatedPost.href} className="font-medium text-accent hover:text-accent-hover">
            {tool.relatedPost.title}
          </Link>
          .
        </p>
      </section>

      <RelatedOffers context="ai" heading="Recommended tools" />

      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-12 text-center">
          <p className="text-ink-muted">
            More AI tools:{' '}
            <Link href="/video-to-text" className="font-medium text-accent hover:text-accent-hover">Video to text</Link>{' · '}
            <Link href="/video-summary" className="font-medium text-accent hover:text-accent-hover">Video summary</Link>
            {' · or '}
            <Link href="/video-downloader" className="font-medium text-accent hover:text-accent-hover">download the video</Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
