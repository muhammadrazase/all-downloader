import Link from 'next/link';
import { FAQ } from './FAQ';
import { Steps } from './Steps';
import { Breadcrumbs } from './Breadcrumbs';
import { JsonLd } from './JsonLd';
import { TrackView } from './TrackView';
import { AdSlot } from './ads/AdSlot';
import type { PdfTool } from '@/lib/pdfTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { webApplicationSchema, faqSchema, howToSchema, breadcrumbSchema } from '@/lib/schema';

/** Server shell for a PDF tool page. No AdSlot near the interactive box — re-layout there is an INP risk on a working surface. */
export function PdfToolPage({ tool, children }: { tool: PdfTool; children: React.ReactNode }) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: tool.name, path: `/${tool.slug}` },
  ];
  const otherTools = PDF_TOOL_LIST.filter((t) => t.slug !== tool.slug);
  return (
    <>
      <TrackView tool={tool.slug} />
      <JsonLd data={webApplicationSchema(tool.metaTitle, `/${tool.slug}`, tool.metaDescription, 'UtilitiesApplication')} />
      <JsonLd data={faqSchema(tool.faqs)} />
      <JsonLd data={howToSchema(`How to ${tool.name.toLowerCase()}`, tool.steps)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center sm:py-14">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold text-ink sm:text-5xl">{tool.h1}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">{tool.intro}</p>
        <div className="mx-auto mt-8 max-w-2xl text-left">{children}</div>
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
        <AdSlot placement="rectangle" ezoicId={108} context="converter" />
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
      </section>

      {otherTools.length > 0 && (
        <section className="border-t border-surface-border bg-surface-soft">
          <div className="container-page py-12 text-center">
            <p className="text-ink-muted">
              More PDF tools:{' '}
              {otherTools.map((t, i) => (
                <span key={t.slug}>
                  {i > 0 && ' · '}
                  <Link href={`/${t.slug}`} className="font-medium text-accent hover:text-accent-hover">{t.name}</Link>
                </span>
              ))}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
