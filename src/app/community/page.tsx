import Link from 'next/link';
import type { Metadata } from 'next';
import { GiscusComments } from '@/components/GiscusComments';
import { site } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';
import { getSetting } from '@/lib/config/settings.server';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Community — Ask, Share & Get Help',
  description:
    'Join the SnapVidly community. Ask questions, share tips, request features and get help downloading from TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr.',
  path: '/community',
});

export default function CommunityPage() {
  // Community links + Giscus are admin-editable (Site settings) — DB > env.
  const discordUrl = getSetting('DISCORD_URL') || site.discordUrl;
  const telegramUrl = getSetting('TELEGRAM_URL') || site.telegramUrl;
  const giscus = {
    repo: getSetting('GISCUS_REPO') || site.giscus.repo,
    repoId: getSetting('GISCUS_REPO_ID') || site.giscus.repoId,
    category: site.giscus.category,
    categoryId: getSetting('GISCUS_CATEGORY_ID') || site.giscus.categoryId,
  };

  return (
    <>
      <section className="container-page py-14 text-center">
        <h1 className="text-4xl font-bold text-ink">Join the community</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
          Ask questions, share tips, request features, and help others get the most out of SnapVidly.
        </p>
      </section>

      {(discordUrl || telegramUrl) && (
        <section className="container-page pb-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {discordUrl && (
              <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="card group flex items-center gap-4 p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5865F2]/10 text-[#5865F2]">💬</span>
                <div>
                  <h2 className="text-lg font-semibold text-ink group-hover:text-accent">Discord</h2>
                  <p className="text-sm text-ink-muted">Chat in real time and get quick help.</p>
                </div>
              </a>
            )}
            {telegramUrl && (
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="card group flex items-center gap-4 p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#229ED9]/10 text-[#229ED9]">✈️</span>
                <div>
                  <h2 className="text-lg font-semibold text-ink group-hover:text-accent">Telegram</h2>
                  <p className="text-sm text-ink-muted">Follow updates and new features.</p>
                </div>
              </a>
            )}
          </div>
        </section>
      )}

      {/* Community guidelines */}
      <section className="container-page py-10">
        <div className="mx-auto max-w-prose">
          <h2 className="text-2xl">Community guidelines</h2>
          <ul className="mt-4 space-y-2 text-ink-muted">
            <li>Be respectful and helpful — we’re all here to learn.</li>
            <li>Only download content you own or have permission to use.</li>
            <li>No spam, self-promotion, or piracy requests.</li>
            <li>Search before posting — your question may already be answered.</li>
          </ul>
        </div>
      </section>

      {/* Giscus board */}
      <section className="container-page py-10">
        <div className="mx-auto max-w-prose">
          <h2 className="text-2xl">Discussion board</h2>
          <p className="mt-2 text-ink-muted">
            Start a thread below. Discussions are powered by GitHub — no separate account, no database, spam-protected.
          </p>
          <div className="mt-6">
            <GiscusComments giscus={giscus} />
          </div>
        </div>
      </section>

      <section className="container-page pb-16 text-center">
        <p className="text-sm text-ink-muted">
          Looking for a guide instead? Visit the{' '}
          <Link href="/blog" className="font-medium text-accent hover:text-accent-hover">blog</Link>.
        </p>
      </section>
    </>
  );
}
