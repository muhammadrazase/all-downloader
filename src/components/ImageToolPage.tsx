import Link from 'next/link';
import { ImageDownloaderBox } from './ImageDownloaderBox';
import { PlatformIcon } from './PlatformIcon';
import { FAQ } from './FAQ';
import { Steps } from './Steps';
import { Breadcrumbs } from './Breadcrumbs';
import { JsonLd } from './JsonLd';
import { TrackView } from './TrackView';
import { AdSlot } from './ads/AdSlot';
import type { ImageTool } from '@/lib/imageTools';
import type { PlatformKey } from '@/lib/platforms';
import { webApplicationSchema, faqSchema, howToSchema, breadcrumbSchema } from '@/lib/schema';

/** Full landing page for an image (thumbnail) tool — mirrors the video tool page. */
export function ImageToolPage({ tool }: { tool: ImageTool }) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: tool.name + ' Downloader', path: `/${tool.slug}` },
  ];
  // The icon key maps to a platform glyph (youtube / tiktok).
  const iconKey = (tool.key === 'youtube-thumbnail' ? 'youtube' : 'tiktok') as PlatformKey;

  return (
    <>
      <TrackView tool={tool.slug} />
      <JsonLd data={webApplicationSchema(tool.metaTitle, `/${tool.slug}`, tool.metaDescription)} />
      <JsonLd data={faqSchema(tool.faqs)} />
      <JsonLd data={howToSchema(`How to download a ${tool.name}`, tool.steps)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center sm:py-14">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${tool.brandColor}14` }}>
          <PlatformIcon platform={iconKey} color={tool.brandColor} className="h-7 w-7" />
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold text-ink sm:text-5xl">{tool.h1}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">{tool.intro}</p>
        <div className="mx-auto mt-8 max-w-2xl">
          <ImageDownloaderBox toolKey={tool.key} autoFocus />
          <p className="mt-3 break-all text-sm text-ink-faint">Example: {tool.urlExample}</p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tool.features.map((f) => (
            <div key={f.title} className="card p-5">
              <h2 className="text-lg">{f.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={106} />
      </div>

      <section className="container-page py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl">How to download a {tool.name.toLowerCase()}</h2>
        </div>
        <div className="mx-auto max-w-2xl">
          <Steps title="Step by step" steps={tool.steps} />
        </div>
      </section>

      <section className="container-page py-14">
        <FAQ faqs={tool.faqs} heading={`${tool.name} downloader — FAQ`} />
      </section>

      <section className="border-t border-surface-border bg-surface-soft">
        <div className="container-page py-12 text-center">
          <p className="text-ink-muted">
            Want the full video instead? Try the{' '}
            <Link href={`/${iconKey === 'youtube' ? 'youtube-video-downloader' : 'tiktok-downloader'}`} className="font-medium text-accent hover:text-accent-hover">
              {iconKey === 'youtube' ? 'YouTube' : 'TikTok'} video downloader
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
