# SnapVidly

A fast, SEO-first social media video downloader with a blog and community — built with **Next.js 15 (App Router, RSC) + TypeScript + Tailwind**, no application database.

Supports **TikTok, Instagram, YouTube, Facebook, LinkedIn** on mobile and desktop. See [PLAN.md](PLAN.md) for the full architecture and [CLAUDE.md](CLAUDE.md) for the engineering + design rules.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build (SSG)
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

### One-shot PWA build with your domain + QR

```bash
npm run build:pwa -- https://your-domain.com
# or:  SITE_URL=https://your-domain.com npm run build:pwa
```

This single command:
1. Normalizes the URL and injects it as `NEXT_PUBLIC_SITE_URL`, so **every** canonical tag, sitemap entry, manifest field and the on-site install QR point at your domain.
2. Generates a shareable QR → `public/qr.png` + `public/qr.svg` (served at `/qr.png`, `/qr.svg`) and prints a scannable QR to the terminal.
3. Runs the production build.

Then `npm run start` and scan the QR to install the app on a phone.

## How the downloader works

The UI is a thin static shell. The real work is the **extraction engine**, chosen by env:

| Mode | When | How |
|---|---|---|
| **Remote engine** (production, recommended) | `ENGINE_URL` is set | `/api/extract` forwards to your engine service, which runs `yt-dlp`/`ffmpeg` or a managed API and returns **direct CDN links**. |
| **Local yt-dlp** (self-host / dev) | `ENGINE_URL` unset | `/api/extract` spawns the local `yt-dlp` binary (args array, timeout, SSRF-guarded). |

> **The bandwidth rule:** the engine returns direct CDN links; SnapVidly never proxies video bytes. This keeps it fast and cheap.

### Enable local extraction (dev)

```bash
pipx install yt-dlp   # or: pip install -U yt-dlp
sudo apt-get install -y ffmpeg
```

Then paste a link in the UI — no `ENGINE_URL` needed.

## Security (built in)

- **SSRF guard + host whitelist** per platform ([src/lib/validate.ts](src/lib/validate.ts)) — internal/loopback/link-local addresses rejected.
- **No shell injection** — `yt-dlp` is spawned with an args array, never a shell string.
- **Rate limiting** via Upstash Redis (per-IP) — degrades to permissive locally, **required in production**.
- **Zod** validation on every request; **timeouts** on every extraction; security headers in [next.config.mjs](next.config.mjs).

Verified live: internal-IP → `400`, wrong-host → `400`, `GET /api/extract` → `405`.

## Content (no database)

- **Blog:** 30 MDX posts in [content/blog/](content/blog/) (6 per platform). Add a file → it appears in the index, category, sitemap and RSS automatically.
- **Community:** Giscus (GitHub Discussions) + Discord/Telegram — zero DB. Configure via `NEXT_PUBLIC_GISCUS_*`.

## PWA / installable app

SnapVidly is a full Progressive Web App — installable on Android, iOS and desktop:

- **Manifest** ([src/app/manifest.ts](src/app/manifest.ts)) — standalone display, theme color, maskable icons, and app **shortcuts** to each downloader (long-press the installed icon).
- **Service worker** ([public/sw.js](public/sw.js)) — offline app shell + `/offline` fallback; never caches the API or third-party scripts. Registered in production only.
- **Icons** — generated at build ([src/app/icon.tsx](src/app/icon.tsx), [src/app/apple-icon.tsx](src/app/apple-icon.tsx)) plus maskable SVGs in `/public`.
- **Install UI** — a "Get the app" section on the home page with a **build-time QR code** (zero client JS) and a native **Install** button (`beforeinstallprompt` on Android/desktop; Share → Add to Home Screen steps for iOS).

## Monetization (ad networks) — config-only

All ad networks are driven by `NEXT_PUBLIC_*` env vars ([src/lib/ads.ts](src/lib/ads.ts)). Add the keys you have, rebuild, and they turn on. Blank = fully off (no script, **no layout shift**).

- **Display banners** (in-content, CLS-safe, priority Ezoic → Media.net → Adsterra) via [AdSlot](src/components/ads/AdSlot.tsx).
- **Global formats** (popunder / social-bar / push) for Adsterra, Monetag, PropellerAds, HilltopAds, Galaksion via [AdScripts](src/components/ads/AdScripts.tsx) — lazy-loaded so they never block the page.

See `.env.example` for every supported key. For Ezoic, create placeholder ids **101** (tool pages) and **102** (blog posts) in your Ezoic dashboard.

> Note: Google AdSense typically rejects downloader sites — use the networks above instead. See [PLAN.md](PLAN.md) §15.

## SEO surface

Per-page `Metadata` (canonical, OG, Twitter) · JSON-LD (`Organization`, `WebSite`, `WebApplication`, `FAQPage`, `HowTo`, `Article`, `BreadcrumbList`) · dynamic `sitemap.xml`, `robots.txt`, `rss.xml` · dynamic OG images at `/api/og` · internal-link mesh · CWV-optimized SSG (system fonts, ~105–120 kB first-load JS).

## Configuration

Copy `.env.example` → `.env.local` and fill in:

```bash
ENGINE_URL=                    # remote engine (omit to use local yt-dlp)
ENGINE_KEY=
UPSTASH_REDIS_REST_URL=        # rate limiting (required in prod)
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_GISCUS_REPO=       # community
NEXT_PUBLIC_GISCUS_REPO_ID=
NEXT_PUBLIC_GISCUS_CATEGORY_ID=
```

Also update brand/domain/social URLs in [src/lib/site.ts](src/lib/site.ts).

## Deploy

- **Frontend:** Vercel or Cloudflare Pages (static + edge). Set env vars in the dashboard.
- **Engine:** a Node service on Railway / Fly.io / a VPS with `yt-dlp` + `ffmpeg` (long-running process). Point `ENGINE_URL` at it.

## Tech notes

- **Fonts:** native system-font stack (zero web-font request → best CWV). To brand with Inter, drop a woff2 into `/public/fonts` and load via `next/font/local` (see the note in [src/app/layout.tsx](src/app/layout.tsx)).
- **Routing:** the 5 tool pages are one DRY dynamic route (`src/app/[tool]`) with `generateStaticParams`; unknown top-level paths 404.
