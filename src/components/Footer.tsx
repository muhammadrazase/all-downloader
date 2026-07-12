import Link from 'next/link';
import { Logo } from './Logo';
import { nav, site } from '@/lib/site';
import { PLATFORM_LIST } from '@/lib/platforms';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { AI_TOOL_LIST } from '@/lib/aiTools';

// Full internal-link mesh for SEO (auto-grows with the registries).
const downloaderLinks = PLATFORM_LIST.map((p) => ({ label: p.name, href: `/${p.slug}` }));
const toolsLinks = [
  { label: 'All-in-One Downloader', href: '/video-downloader' },
  { label: 'Bulk Downloader', href: '/batch-video-downloader' },
  ...AI_TOOL_LIST.map((t) => ({ label: t.name, href: `/${t.slug}` })),
  ...IMAGE_TOOL_LIST.map((t) => ({ label: `${t.name} Downloader`, href: `/${t.slug}` })),
  ...CONVERTER_LIST.map((t) => ({ label: t.name, href: `/${t.slug}` })),
  { label: 'Browser Extension', href: '/browser-extension' },
];

/** Server-rendered footer with the internal-link mesh SEO relies on. */
export function Footer() {
  const year = 2026;
  return (
    <footer className="mt-12 border-t border-surface-border bg-surface-soft">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">{site.tagline}</p>
          {(site.discordUrl || site.telegramUrl) && (
            <div className="mt-5 flex gap-3">
              {site.discordUrl && (
                <a href={site.discordUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:text-accent-hover">
                  Discord
                </a>
              )}
              {site.telegramUrl && (
                <a href={site.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:text-accent-hover">
                  Telegram
                </a>
              )}
            </div>
          )}
        </div>

        <FooterCol title="Downloaders" links={downloaderLinks} />
        <FooterCol title="Tools" links={toolsLinks} />
        <FooterCol title="Company" links={nav.primary} />
        <FooterCol title="Legal" links={nav.legal} />
      </div>

      <div className="border-t border-surface-border">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-sm text-ink-muted sm:flex-row">
          <p>© {year} {site.name}. All rights reserved.</p>
          <p className="text-xs">
            Download only content you own or have permission to use.{' '}
            <Link href="/disclaimer" className="underline hover:text-ink">
              Read the disclaimer
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: readonly { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-ink-muted transition-colors hover:text-accent">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
