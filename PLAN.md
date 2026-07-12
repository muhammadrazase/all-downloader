# SnapVidly — End-to-End Build Plan

> **Product:** A blazing-fast, SEO-first social media video downloader + blog + community platform
> **Stack:** Next.js 15 (App Router, RSC, TypeScript) · Tailwind CSS · MDX · No application database
> **Video platforms (11):** TikTok · Instagram · YouTube · Facebook · LinkedIn · Twitter/X · Pinterest · Reddit · Vimeo · Twitch · Tumblr
> **Image tools (2):** YouTube Thumbnail · TikTok Thumbnail downloaders
> **Content:** 63 blog posts · **Status:** Built & production-ready
> **Owner:** _you_ · **Last updated:** 2026-07-10
>
> 🧩 Platform/tool **expansion** design & scope is in **[PLAN-EXPANSION.md](PLAN-EXPANSION.md)**.

---

## Table of Contents

1. [Reality Check — Read First](#1-reality-check--read-first)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [The Download Engine (the real product)](#3-the-download-engine-the-real-product)
4. [System Architecture](#4-system-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Information Architecture & Routes](#6-information-architecture--routes)
7. [Page-by-Page Specification](#7-page-by-page-specification)
8. [SEO Strategy (expert level)](#8-seo-strategy-expert-level)
9. [Content Plan — 30 Blogs](#9-content-plan--30-blogs)
10. [Community Without a Database](#10-community-without-a-database)
11. [UX / UI Design System](#11-ux--ui-design-system)
12. [Performance Budget & Strategy](#12-performance-budget--strategy)
13. [Security & Abuse Prevention](#13-security--abuse-prevention)
14. [Legal & Compliance](#14-legal--compliance)
15. [Monetization](#15-monetization)
16. [Folder Structure](#16-folder-structure)
17. [Key Code Contracts](#17-key-code-contracts)
18. [Analytics & Observability](#18-analytics--observability)
19. [Delivery Roadmap (phased)](#19-delivery-roadmap-phased)
20. [Risk Register](#20-risk-register)
21. [Definition of Done](#21-definition-of-done)
22. [Environment Variables](#22-environment-variables)

---

## 1. Reality Check — Read First

Two requirements in the original brief contain hidden traps. Solving them is part of the plan, not an afterthought.

### Trap A — "No database" **and** "community" are mutually exclusive
A real community (threads, replies, upvotes, profiles) **requires persistence**. You cannot self-build that with zero database.
**Resolution:** Do not build a forum. Use a **hosted community layer** that keeps *your* infrastructure database-free:
- **Giscus** — comment/discussion threads backed by GitHub Discussions (free, spam-protected, OAuth handled).
- **Discord / Telegram** — real-time community hub linked from the site.

This is objectively **better** than a homegrown forum: moderation, auth, and spam are handled for you.

### Trap B — "YouTube downloader" collides with monetization + law
- Downloading from these platforms violates their Terms of Service.
- **Google AdSense bans downloader sites.** Do **not** base revenue on AdSense.
- YouTube actively fights extraction (signature ciphers, PO tokens, datacenter-IP blocking).

**Resolution:** Operate in the grey zone deliberately and harden against the predictable consequences — alternative ad networks, a self-hosted engine only for the *easy* platforms, a managed API for YouTube, DMCA/disclaimer pages, and rate limiting. All detailed below.

**Core insight that governs the whole build:**
> The download engine is the product. The UI is trivial. The #1 cost-and-speed killer is proxying video bytes through your own server. Always hand the browser a **direct CDN link**.

---

## 2. Goals & Non-Goals

### Goals
- Fastest-possible perceived load (Lighthouse 95+, LCP < 1.5s).
- Effortless UX: paste a link → get the video. Zero learning curve.
- Rank on page 1 for `{platform} video downloader` keyword clusters.
- 5 platform tools, 30 blog posts, community, and full legal/trust surface.
- Zero application database; content lives in files; community is hosted.

### Non-Goals
- No user accounts, no saved history, no server-side video storage.
- No self-built forum, no heavy SPA framework, no CSS-in-JS runtime.
- No hosting/rehosting of copyrighted content (fetch-on-demand only).

---

## 3. The Download Engine (the real product)

You **cannot** download these videos purely client-side — CORS, auth, and signature ciphers block it. Extraction must run server-side.

### 3.1 Two engine strategies

| | A. Self-hosted (`yt-dlp` + `ffmpeg`) | B. Third-party API (RapidAPI etc.) |
|---|---|---|
| Cost | Server + bandwidth only | $10–100+/mo subscription |
| Maintenance | **High** — breaks weekly (YT) | **Zero** — vendor fights the cat-and-mouse |
| Control | Full | Rate-limited, vendor dependency |
| Best for | TikTok, Facebook, LinkedIn | YouTube, Instagram |

### 3.2 Recommended: **Hybrid**
1. **MVP:** everything on third-party APIs → ship in days.
2. **Optimize:** self-host the *easy* platforms (TikTok/FB/LinkedIn) to cut API cost.
3. **YouTube stays on a managed API forever** — self-hosting YT extraction on datacenter IPs is a losing battle.

### 3.3 The bandwidth rule (non-negotiable)
Your server extracts the **direct CDN video URL** and returns it. The browser downloads from the source CDN.
- **Never** stream video bytes through your own server unless forced (watermark strip / forced filename).
- When you *must* proxy: **stream**, never buffer into memory. A timeout on every request.

### 3.4 Per-platform feasibility

| Platform | Difficulty | Method | Engine |
|---|---|---|---|
| TikTok | Easy | Public endpoints → no-watermark MP4 | Self-host |
| Facebook | Easy | HD/SD URLs in public page HTML | Self-host |
| LinkedIn | Easy | DASH/MP4 URLs in page source | Self-host |
| Instagram | Medium | GraphQL; some content needs cookies | API |
| YouTube | Hard | Signature ciphers + PO tokens + IP blocks | **API only** |

### 3.5 Engine response contract
```jsonc
{
  "title": "string",
  "thumbnail": "https://cdn…/thumb.jpg",
  "duration": 42,
  "formats": [
    { "quality": "1080p", "ext": "mp4", "url": "https://cdn…/video.mp4", "hasAudio": true,  "size": 12800000 },
    { "quality": "audio", "ext": "mp3", "url": "https://cdn…/audio.mp3", "hasAudio": true }
  ]
}
```

---

## 4. System Architecture

```
                 ┌──────────────────────────────────────────┐
 Browser  ──────▶│  Next.js (Vercel / Cloudflare Pages)      │
 (paste URL)     │  • Static tool pages + blog (SSG, edge)   │
                 │  • /api/extract  (thin, safe proxy)       │
                 └───────────────┬──────────────────────────┘
                                 │  POST {url, platform}
                                 ▼
                 ┌──────────────────────────────────────────┐
                 │  Engine Service (Railway / Fly / VPS)     │
                 │  • yt-dlp + ffmpeg (self-host platforms)  │
                 │  • or forwards to third-party API         │
                 │  • returns DIRECT CDN links (no bytes)    │
                 └───────────────┬──────────────────────────┘
                                 │  { formats:[{ url }] }
                                 ▼
 Browser  ◀──────────  downloads directly from source CDN
```

- **Why a 2-box split?** `yt-dlp` + `ffmpeg` need a long-running process and binaries — Vercel serverless can't hold that reliably. The frontend stays on the edge CDN for speed; the engine lives where it can run processes.
- **Rate limiting** uses Upstash Redis (a cache/limit store, *not* your app DB — the "no database" rule is about application data, and this respects it).

---

## 5. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, RSC, TypeScript | Static + edge + minimal JS |
| Rendering | SSG for all pages; client hydration only on the paste box | Sub-second loads |
| Styling | Tailwind CSS (no UI lib, no CSS-in-JS runtime) | "Fastest / no heavy things" |
| Content | MDX via Contentlayer/Velite or `@next/mdx` | Blogs as files, zero DB |
| Frontend API | Next.js Route Handlers | Thin proxy + guards |
| Engine | Node service + `yt-dlp` + `ffmpeg` on Railway/Fly | Process + binaries |
| Rate limit | Upstash Redis (`@upstash/ratelimit`) | Serverless-friendly limits |
| Community | Giscus + Discord/Telegram | Zero-DB community |
| Analytics | Plausible / Cloudflare Web Analytics | Cookieless, no consent banner |
| CAPTCHA | Cloudflare Turnstile | Abuse protection, lightweight |

---

## 6. Information Architecture & Routes

```
/                                     Home — hero + universal paste box + platform grid
/tiktok-downloader                    ┐
/instagram-video-downloader           │
/youtube-video-downloader             │  SEO-optimized tool landing pages
/facebook-video-downloader            │
/linkedin-video-downloader            ┘
/how-to/[platform]                    HowTo guides (schema.org HowTo → rich results)
/blog                                 Blog index (paginated)
/blog/[category]                      Per-platform hub (tiktok, instagram, …)
/blog/[category]/[slug]               30 posts (6 × 5 platforms)
/community                            Hub → Giscus board + Discord/Telegram
/about                                E-E-A-T trust page
/contact                              Contact form (serverless email, no DB)
/terms  /privacy  /dmca  /disclaimer  Legal + trust
/sitemap.xml  /robots.txt  /rss.xml   Auto-generated
```

---

## 7. Page-by-Page Specification

### Home (`/`)
- Above the fold: one large paste box that **auto-detects the platform from the URL** (no dropdown).
- Platform grid (5 cards) linking to each tool page.
- Trust strip: "Free · No signup · No watermark · Works on mobile & PC".
- Short "How it works" (3 steps) + FAQ (with `FAQPage` schema).

### Tool pages (`/{platform}-downloader`)
- H1 with exact-match keyword, the downloader box, platform-specific copy.
- **Sections:** How to download on mobile · How to download on PC · Features · FAQ (schema) · Related blog links.
- JSON-LD: `WebApplication` + `FAQPage`.

### How-to pages (`/how-to/[platform]`)
- Step-by-step with `HowTo` JSON-LD for rich results. Deep-links to the tool.

### Blog (`/blog`, `/blog/[category]`, `/blog/[category]/[slug]`)
- Index paginated; category = platform hub; post = MDX with `Article` + `BreadcrumbList` schema, custom OG image, FAQ block, internal links to the matching tool page.

### Community (`/community`)
- Giscus board embed + prominent Discord/Telegram join buttons + community guidelines.

### Legal (`/about /contact /terms /privacy /dmca /disclaimer`)
- Required for trust, SEO E-E-A-T, and ad-network approval. Contact form posts to a serverless email service (Resend/EmailJS) — no DB.

---

## 8. SEO Strategy (expert level)

### On-page
- **Exact-match slugs** for money keywords (`/tiktok-downloader`).
- Per-page `Metadata` API: title, description, canonical, OpenGraph, Twitter card.
- Semantic HTML, one `<h1>`, descriptive `alt`, breadcrumb nav.

### Structured data (JSON-LD)
| Page | Schema |
|---|---|
| Sitewide | `Organization`, `WebSite` (+ Sitelinks Search) |
| Tool pages | `WebApplication` + `FAQPage` |
| How-to | `HowTo` |
| Blog post | `Article` + `BreadcrumbList` |

### Content / authority
- **30 blog posts** build topical authority; each links to its tool page (internal-link mesh).
- Cover 2025 recap, 2026 predictions, platform history, how-to, tips, and legality — capturing informational + transactional intent.

### Technical
- Dynamic `sitemap.ts` + `robots.ts` + `rss.xml`.
- **Core Web Vitals as a ranking lever:** SSG + minimal JS → near-perfect LCP/CLS/INP. Here "fastest site" and "best SEO" are the *same* goal.

---

## 9. Content Plan — 30 Blogs

Per platform, 6 posts (× 5 = 30). Each ~1200–1800 words, one focus keyword, FAQ block, internal links, custom OG image.

| # | Template | Search intent |
|---|---|---|
| 1 | History & evolution of {platform} | Informational |
| 2 | {platform} 2025 recap + 2026 predictions & innovations | Informational / trend |
| 3 | How to download {platform} videos on mobile + PC | Transactional (→ tool) |
| 4 | Best content ideas / trends on {platform} for 2026 | Informational |
| 5 | Creator tips: going viral / the 2026 algorithm | Informational |
| 6 | Is downloading {platform} videos legal? Safe-use guide | Trust / legality |

> This 6-post structure per platform is a **topical-authority moat** — competitors with only a tool page can't outrank a full content cluster.

---

## 10. Community Without a Database

| Need | Solution | DB required? |
|---|---|---|
| Threaded discussion | **Giscus** (GitHub Discussions backend) | No |
| Real-time chat | **Discord** or **Telegram** group | No |
| Blog comments | Giscus per-post | No |
| Moderation / spam / auth | Handled by GitHub/Discord | No |

`/community` embeds Giscus and links the chat hub. Zero infrastructure, spam-protected, launch-ready.

---

## 11. UX / UI Design System

### Ease-of-use rules (make it effortless)
1. **Auto-detect platform** from the pasted URL — no dropdown.
2. **Clipboard read on focus** (with permission) → mobile users tap once.
3. **Thumbnail + title preview** before download → trust it's the right video.
4. **Plain-language format buttons** — "HD 1080p · MP4", "Audio only · MP3" — not codec jargon.
5. **Large touch targets**, mobile-first layout.

### Downloader state machine
```
idle
  └─▶ validating   (instant client-side regex)
        └─▶ fetching   (spinner: "Fetching…")
              ├─▶ ready   → thumbnail + title + [quality/format buttons] + download
              └─▶ error   → inline red message + retry (never a blank screen)
```

### Visual system
- Tailwind tokens: one accent color, neutral grays, 8px spacing scale.
- Dark + light via `prefers-color-scheme`.
- One self-hosted font subset, `display: swap`. No icon font — inline SVG only.
- Accessibility: ARIA on the paste box, full keyboard nav, visible focus rings, AA contrast.

---

## 12. Performance Budget & Strategy

### Budgets
| Metric | Target |
|---|---|
| Lighthouse (all categories) | ≥ 95 |
| LCP | < 1.5s |
| CLS | < 0.05 |
| INP | < 200ms |
| JS shipped (tool page, gzipped) | < 100 KB |

### How we hit them
- 100% static HTML served from edge CDN; JS hydrates only the paste box.
- No client data libraries, no animation libraries — CSS transitions only.
- `next/image` for images; lazy-load below the fold.
- One font, subset, `swap`. Route-level code splitting (App Router default).
- The **"never proxy bytes"** rule keeps the server fast and cheap.

---

## 13. Security & Abuse Prevention

| Threat | Mitigation |
|---|---|
| **SSRF** (user pastes `http://169.254.169.254/…`) | Whitelist host regex per platform; reject anything else |
| **Command injection** into `yt-dlp` | Never `exec` raw input; pass args as an array, validate first |
| **Abuse / bandwidth blowout** | Upstash rate limit (per-IP), Turnstile CAPTCHA on extract |
| **Hanging requests** | `AbortSignal.timeout()` on every extraction |
| **Engine breakage** | API fallback + health checks + graceful "temporarily unavailable" |
| **IP bans on self-hosted engine** | Rotating proxy pool |
| **Secret leakage** | Engine key server-side only; no secrets in client/logs/URLs |

---

## 14. Legal & Compliance

- **Disclaimer:** "Download only content you own or have the rights to."
- **No storage:** we fetch public URLs on demand; we never host copyrighted files.
- **DMCA page** with a takedown contact + process.
- **Terms, Privacy, Disclaimer** pages present sitewide (also required by ad networks).
- **Cookieless analytics** avoids a GDPR consent banner (faster + simpler).

---

## 15. Monetization

> **AdSense is off the table** (bans downloader sites). Plan for alternatives from day one.

| Stream | Options | Notes |
|---|---|---|
| Display ads | **Ezoic, Media.net, Adsterra, Monetag** | Approve downloader traffic |
| Affiliate | VPN, cloud storage, video editors | High intent on tool pages |
| Own product | Pro tier (batch, higher res, API) | Later phase |

### 15.1 Ad system (implemented — config-driven)
- **Networks supported** (env-driven, blank = off): Ezoic, Media.net, Adsterra, Monetag, PropellerAds, HilltopAds, Galaksion.
- **Display banners (300×250)** on tool pages, blog posts, blog index, blog category pages — Ezoic placeholder ids `101`–`104`. Priority **Ezoic → Media.net → Adsterra** (first configured wins each slot).
- **Global formats** (popunder / social-bar / push) load once, reach every page. **One popunder max** (running two conflicts + violates ToS).
- **Performance:** banners **lazy-load** ~400px before viewport (protects CWV + improves viewability/revenue); Adsterra banners sandboxed in isolated iframes (no `atOptions` collision).
- **Compliance:** `ads.txt` at `/public/ads.txt` (mandatory per network); optional **consent gate** (`NEXT_PUBLIC_CONSENT_REQUIRED=true`) defers ads + analytics until Accept (GDPR/CCPA). Warn against **invalid traffic** (never click own ads → ban).
- **Rollout:** month 1 → Adsterra (instant approval); month 3–4 → add Ezoic (higher RPM); Media.net if US/UK traffic. Full step-by-step in [ADS-SETUP.md](ADS-SETUP.md).

### 15.2 Recommendations
- Start with **one** network (Adsterra), verify earnings, then layer in Ezoic — don't sign up for all seven at once.
- Prefer **300×250** over 728×90 (most traffic is mobile; 300×250 is every network's highest-demand unit).
- Add **affiliate cards** (VPN/cloud storage) on tool pages early — higher margin than ads, no page-speed cost, no policy risk.
- Long term, a **Pro tier via LemonSqueezy** is the only revenue no ad network can revoke.

---

## 16. Folder Structure

```
app/
  (marketing)/            home, about, contact
  (legal)/                terms, privacy, dmca, disclaimer
  (tools)/[platform]-downloader/page.tsx
  how-to/[platform]/page.tsx
  blog/
    page.tsx
    [category]/page.tsx
    [category]/[slug]/page.tsx
  community/page.tsx
  api/extract/route.ts    thin proxy → engine service
  sitemap.ts
  robots.ts
  rss.xml/route.ts
components/
  DownloaderBox.tsx  PlatformGrid.tsx  FAQ.tsx  BlogCard.tsx
  Navbar.tsx  Footer.tsx  Breadcrumbs.tsx  JsonLd.tsx
content/
  blog/{tiktok,instagram,youtube,facebook,linkedin}/*.mdx
lib/
  seo.ts  schema.ts  platforms.ts  validate.ts
public/
  og/  icons/
engine/                   (separate repo/service)
  server.ts  extractors/{tiktok,facebook,linkedin,instagram,youtube}.ts
```

---

## 17. Key Code Contracts

### 17.1 Safe extraction proxy — `app/api/extract/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'),
})

// Whitelist: only known public hosts (SSRF guard)
const HOSTS: Record<string, RegExp> = {
  tiktok:    /^https?:\/\/([\w-]+\.)?tiktok\.com\//i,
  instagram: /^https?:\/\/([\w-]+\.)?instagram\.com\//i,
  youtube:   /^https?:\/\/([\w-]+\.)?(youtube\.com|youtu\.be)\//i,
  facebook:  /^https?:\/\/([\w-]+\.)?(facebook\.com|fb\.watch)\//i,
  linkedin:  /^https?:\/\/([\w-]+\.)?linkedin\.com\//i,
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'anon'
  const { success } = await limiter.limit(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { url, platform } = await req.json()
  const re = HOSTS[platform]
  if (!re || typeof url !== 'string' || !re.test(url))
    return NextResponse.json({ error: 'Invalid or unsupported URL' }, { status: 400 })

  try {
    const r = await fetch(`${process.env.ENGINE_URL}/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ENGINE_KEY! },
      body: JSON.stringify({ url, platform }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) throw new Error('engine')
    return NextResponse.json(await r.json()) // direct CDN links — never proxy bytes
  } catch {
    return NextResponse.json(
      { error: 'Could not fetch this video. It may be private or removed.' },
      { status: 502 },
    )
  }
}
```

### 17.2 JSON-LD helpers — `lib/schema.ts`
```ts
export const faqSchema = (qa: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
})

export const toolSchema = (name: string, url: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  url,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
})
// Render: <script type="application/ld+json"
//   dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />
```

### 17.3 Platform config — `lib/platforms.ts`
```ts
export const PLATFORMS = [
  { key: 'tiktok',    name: 'TikTok',    slug: 'tiktok-downloader' },
  { key: 'instagram', name: 'Instagram', slug: 'instagram-video-downloader' },
  { key: 'youtube',   name: 'YouTube',   slug: 'youtube-video-downloader' },
  { key: 'facebook',  name: 'Facebook',  slug: 'facebook-video-downloader' },
  { key: 'linkedin',  name: 'LinkedIn',  slug: 'linkedin-video-downloader' },
] as const
```

---

## 18. Analytics & Observability

- **Cookieless analytics** (Plausible / Cloudflare) — traffic, top pages, conversions, no consent banner.
- **Engine health checks** + uptime monitor (UptimeRobot / BetterStack).
- **Structured logging** on the engine (request id, platform, latency, outcome) — never log full user URLs with PII or secrets.
- Track the funnel metric that matters: **paste → successful download rate** per platform.

---

## 19. Delivery Roadmap (phased)

### Phase 1 — MVP (~1 week)
- Next.js scaffold, Tailwind, layout, Navbar/Footer.
- Home + 5 tool pages (static shells).
- **TikTok downloader live** via one third-party API.
- Legal pages, per-page metadata, `sitemap.ts`, `robots.ts`.
- **Ship.**

### Phase 2 — Full tool + content
- Remaining 4 downloaders.
- FAQ + HowTo schema on all tool/how-to pages.
- 30 blog posts (MDX), blog index + category hubs, RSS.

### Phase 3 — Cost + community
- Self-host TikTok/FB/LinkedIn engine to cut API cost.
- Giscus + Discord/Telegram community.
- Rate limiting + Turnstile + monitoring.

### Phase 4 — Monetize + optimize
- Ad network + affiliate integration.
- A/B test CTAs, expand content, add "Pro" tier if traction warrants.

---

## 20. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | AdSense rejection | Certain | High | Ezoic/Media.net + affiliates from day one |
| 2 | DMCA / legal notice | Medium | High | Disclaimer, DMCA page, no content storage |
| 3 | YouTube extraction breaks | High | Medium | Managed API + fallback + graceful degradation |
| 4 | Bandwidth cost blowout | Medium | High | "Never proxy bytes" — direct CDN links |
| 5 | Abuse / scraping bots | High | Medium | Rate limit + Turnstile |
| 6 | Engine IP bans | Medium | Medium | Rotating proxies |
| 7 | SSRF / injection | Low | Critical | Host whitelist + arg arrays + validation |

---

## 21. Definition of Done

- [ ] All 5 downloaders return correct direct links on mobile + desktop.
- [ ] Lighthouse ≥ 95 on home + every tool page.
- [ ] Every page has correct metadata + canonical + JSON-LD.
- [ ] `sitemap.xml`, `robots.txt`, `rss.xml` valid and live.
- [ ] 30 blog posts published, each linking its tool page.
- [ ] Community (Giscus + chat) live.
- [ ] Terms, Privacy, DMCA, Disclaimer, About, Contact live.
- [ ] Rate limiting + CAPTCHA + SSRF guard verified.
- [ ] Ad network + affiliate live.
- [ ] Uptime + engine health monitoring active.

---

## 22. Environment Variables

```bash
# Frontend (Next.js)
ENGINE_URL=https://engine.example.com
ENGINE_KEY=***                     # server-side only
UPSTASH_REDIS_REST_URL=***
UPSTASH_REDIS_REST_TOKEN=***
TURNSTILE_SECRET_KEY=***
NEXT_PUBLIC_TURNSTILE_SITE_KEY=***
NEXT_PUBLIC_GISCUS_REPO=owner/repo
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=snapvidly.com

# Engine service
THIRD_PARTY_API_KEY=***            # RapidAPI or chosen vendor
PROXY_POOL_URL=***                 # rotating proxies (self-host)
ENGINE_KEY=***                     # must match frontend
```

---

### One-line summary
> Build a static, edge-served Next.js site (fast + SEO), keep the real complexity in a separate extraction engine that returns **direct CDN links**, solve "community without a DB" with Giscus + Discord, and never rely on AdSense. The UI is easy; the engine and the legal/monetization posture are where projects live or die.
