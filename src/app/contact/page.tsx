import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { ContactForm } from '@/components/ContactForm';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Contact Us',
  description: 'Get in touch with the SnapVidly team for questions, feedback, feature requests and support.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageHeader title="Contact us" subtitle="We usually reply within one business day." />
      <section className="container-page pb-16">
        <div className="mx-auto max-w-prose">
          <Suspense fallback={<div className="card h-[26rem] animate-pulse" aria-hidden="true" />}>
            <ContactForm />
          </Suspense>
          <p className="mt-6 text-center text-sm text-ink-muted">
            For copyright and takedown requests, please use our{' '}
            <Link href="/dmca" className="text-accent">DMCA page</Link>. General support:{' '}
            <a href={`mailto:${site.email}`} className="text-accent">{site.email}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
