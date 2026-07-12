import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of Service',
  description: 'The terms of service for using SnapVidly.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms of Service" />
      <article className="prose-ssd mx-auto px-5 pb-16">
        <p><strong>Last updated: January 2026.</strong></p>
        <p>
          By accessing or using SnapVidly (“the service”), you agree to these Terms.
          If you do not agree, please do not use the service.
        </p>
        <h2>1. Acceptable use</h2>
        <p>
          You may use {site.shortName} only for lawful purposes. You agree to download only content you own or are
          authorized to download, and not to use the service to infringe any third party’s rights or to violate the
          terms of any platform. See our <Link href="/disclaimer">disclaimer</Link>.
        </p>
        <h2>2. No account, no storage</h2>
        <p>
          The service does not require an account and does not store the videos you download. Files are fetched directly
          from the source platform and delivered to you.
        </p>
        <h2>3. Availability</h2>
        <p>
          We provide the service “as is” and may change, suspend, or discontinue any part of it at any time. We do not
          guarantee that every link will be downloadable or that the service will be uninterrupted or error-free.
        </p>
        <h2>4. Prohibited conduct</h2>
        <ul>
          <li>Automated scraping, abuse, or attempts to overload the service.</li>
          <li>Reverse engineering or interfering with the service’s security.</li>
          <li>Using the service to distribute malware or unlawful content.</li>
        </ul>
        <h2>5. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, {site.shortName} is not liable for any indirect, incidental, or
          consequential damages arising from your use of the service.
        </p>
        <h2>6. Changes</h2>
        <p>
          We may update these Terms from time to time. Continued use after changes constitutes acceptance. Questions?
          Contact <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </article>
    </>
  );
}
