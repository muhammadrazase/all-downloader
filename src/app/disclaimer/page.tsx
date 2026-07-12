import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Disclaimer',
  description: 'SnapVidly disclaimer — use the service responsibly and only download content you own or have permission to use.',
  path: '/disclaimer',
});

export default function DisclaimerPage() {
  return (
    <>
      <PageHeader title="Disclaimer" subtitle="Please read this before using SnapVidly." />
      <article className="prose-ssd mx-auto px-5 pb-16">
        <p><strong>Last updated: January 2026.</strong></p>
        <p>
          SnapVidly (“we”) is a tool that helps you download publicly available
          videos for personal, lawful use. By using this website you agree to the following.
        </p>
        <h2>Download only what you have the right to</h2>
        <p>
          You are responsible for how you use {site.shortName}. Only download content that you own, that is in the
          public domain, or that you have explicit permission from the rights holder to download. Downloading
          copyrighted material without authorization may violate the law and the terms of service of the platform it
          came from.
        </p>
        <h2>We do not host content</h2>
        <p>
          {site.shortName} does not store, host, or re-upload any videos. When you request a download, the file is
          fetched directly from the source platform’s servers. We are not affiliated with, endorsed by, or sponsored
          by TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch, Tumblr, or any other platform. All trademarks belong to their
          respective owners.
        </p>
        <h2>No warranty</h2>
        <p>
          The service is provided “as is” without warranties of any kind. Platforms change frequently and a download
          may occasionally fail or be unavailable. We are not liable for any loss or damage arising from use of the
          service.
        </p>
        <h2>Copyright concerns</h2>
        <p>
          If you believe content is being accessed through our tool in a way that infringes your rights, please see our{' '}
          <Link href="/dmca">DMCA policy</Link> or contact us at <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </article>
    </>
  );
}
