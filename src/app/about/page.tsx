import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'About SnapVidly',
  description:
    'Learn about SnapVidly — a free, fast, privacy-friendly all-in-one video downloader for TikTok, Instagram, YouTube, Facebook, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and more.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About SnapVidly" subtitle="Fast, free, and built to respect your privacy." />
      <article className="prose-ssd mx-auto px-5 pb-16">
        <p>
          SnapVidly is a free, all-in-one tool that lets anyone save public videos from the platforms they
          use every day — <strong>TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest,
          Vimeo, Twitch and Tumblr</strong> — in high quality, without installing an app or creating an account.
          You can also grab <Link href="/youtube-thumbnail-downloader">YouTube</Link> and{' '}
          <Link href="/tiktok-thumbnail-downloader">TikTok</Link> thumbnails in seconds.
        </p>
        <h2>Why we built it</h2>
        <p>
          Saving a video you love, a clip you were tagged in, or a talk you want to watch offline should be simple. Most
          tools cover just one platform, are slow, buried in ads, or ask you to log in. We built SnapVidly to be the
          opposite: one place for every platform — paste a link, pick a quality, download. That’s it.
        </p>
        <h2>How it works</h2>
        <p>
          When you paste a link, SnapVidly fetches the video directly from the platform’s own servers and hands you a
          direct download in the quality you choose — from 360p up to 4K, or audio-only MP3. We never re-host your
          videos and we don’t store them. You get the original quality, fast, and works the same on mobile and PC.
        </p>
        <h2>Our principles</h2>
        <ul>
          <li><strong>Free and open access.</strong> No signup, no paywall, no limits.</li>
          <li><strong>Privacy first.</strong> We don’t ask for your social logins and we don’t keep your files.</li>
          <li><strong>Respect for creators.</strong> Please only download content you own or have permission to use — see our <Link href="/disclaimer">disclaimer</Link>.</li>
        </ul>
        <h2>Get in touch</h2>
        <p>
          Questions, feedback, or a feature request? Reach us at{' '}
          <a href={`mailto:${site.email}`}>{site.email}</a> or visit the{' '}
          <Link href="/contact">contact page</Link>. You can also join our <Link href="/community">community</Link>.
        </p>
      </article>
    </>
  );
}
