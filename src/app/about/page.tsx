import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'About SnapVidly',
  description:
    'Learn about SnapVidly, a free hub of 44 tools for video, PDF and file tasks, and meet the owner who builds and maintains it.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About SnapVidly" subtitle="Fast, free, and built to respect your privacy." />
      <article className="prose-ssd mx-auto px-5 pb-12">
        <p>
          SnapVidly is a free hub of tools for the things people do with video, PDF and files every day. Save public
          videos from <strong>TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo,
          Twitch and Tumblr</strong> in high quality, then turn a video into text or a summary with AI, convert or trim
          it, merge or edit a PDF, compress an image, generate a QR code and more, all without installing an app or
          creating an account.
        </p>
        <h2>Why we built it</h2>
        <p>
          Getting a simple task done online should not mean wading through ads, fake download buttons and a dozen
          different single-purpose sites. We built SnapVidly to be the opposite: one place, 44 tools, each one done
          properly, free, with nothing to sign up for.
        </p>
        <h2>How it works</h2>
        <p>
          Video downloads are fetched directly from the platform&apos;s own servers, in the quality you choose, from
          360p up to 4K or audio-only MP3. Most of the other tools, PDF editing, format conversion, image tools, run
          entirely in your browser, so your file never leaves your device. Either way, we never store what you upload,
          paste or download.
        </p>
        <h2>Our principles</h2>
        <ul>
          <li><strong>Free and open access.</strong> No signup, no paywall, no limits.</li>
          <li><strong>Privacy first.</strong> We don&apos;t ask for your social logins and we don&apos;t keep your files.</li>
          <li><strong>Respect for creators.</strong> Please only download content you own or have permission to use, see our <Link href="/disclaimer">disclaimer</Link>.</li>
        </ul>
      </article>

      <section className="container-page pb-16">
        <div className="card mx-auto max-w-2xl p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Meet the owner</p>
          <h2 className="mt-2 text-2xl">Muhammad Raza</h2>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Owner &amp; Creator of SnapVidly · Senior Full Stack Software Engineer &amp; Technical Lead · AWS Certified
            Solutions Architect, Professional
          </p>
          <div className="prose-ssd mt-4 max-w-none">
            <p>
              Muhammad Raza owns and maintains SnapVidly, a senior full stack engineer and technical lead with
              eight years of experience building production backends for fintech companies and, more recently, AI
              powered products. He is drawn to the problems most engineers avoid: distributed systems that have to
              survive real money moving through them, AI pipelines that need to hold up at scale, and architecture
              decisions that are expensive to get wrong.
            </p>
            <p>
              SnapVidly grew out of that same standard: a free hub of 44 tools, built with the rigor of a production
              system rather than a side project. If you are working through a genuinely hard technical problem, he
              is always glad to talk it through.
            </p>
          </div>
          <div className="mt-5">
            <a
              href="https://linkedin.com/in/muhammad-raza-eng"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Connect on LinkedIn
            </a>
          </div>
        </div>
      </section>

      <article className="prose-ssd mx-auto px-5 pb-16">
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
