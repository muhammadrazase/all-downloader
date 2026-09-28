import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Thank You',
  description: 'Thank you for supporting SnapVidly.',
  path: '/support/thank-you',
  noindex: true,
});

export default function SupportThankYouPage() {
  return (
    <section className="container-page py-24 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      </span>
      <h1 className="mx-auto mt-5 max-w-lg text-2xl">Thank you, truly</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        Your support means a lot and goes straight toward keeping SnapVidly free for everyone. We are grateful you
        are here.
      </p>
      <Link href="/" className="btn-accent mt-7 inline-flex">
        Back to SnapVidly
      </Link>
    </section>
  );
}
