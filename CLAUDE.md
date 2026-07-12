# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Super Social Downloader (SSD) — the live brand is **SnapVidly**. A fast, SEO-first social-media video downloader with a blog, community, AI tools, and a browser extension. See [PLAN.md](PLAN.md) and the `PLAN-*.md` files for design history.

**Stack:** Next.js 15 (App Router, RSC) · React 19 · TypeScript (strict) · Tailwind CSS 3 · MDX · **no application database**.
**Priorities (in order):** Reliability → Security → Performance → Maintainability → Cost → DX.

---

## Commands

```bash
npm run dev          # local dev server (Next.js)
npm run build        # production build — MUST pass clean before shipping
npm run start        # serve the production build
npm run lint         # next lint (eslint 9, eslint-config-next)
npm run typecheck    # tsc --noEmit — strict, zero errors required
npm run build:pwa <url>   # re-point the whole app to a base URL + build (scripts/build-pwa.mjs)
npm run indexnow     # ping IndexNow with sitemap URLs (scripts/indexnow.mjs)
```

- **`postinstall` runs `scripts/copy-ffmpeg.mjs`** — copies the `@ffmpeg/core` wasm into `public/ffmpeg/` for client-side conversion. If converter pages break after a fresh install, run it manually.
- **No test runner is wired up** (`package.json` has no `test` script) despite CLAUDE's testing standards. When adding tests, also add the script and state the command to run a single test.
- **Deploy:** `up.sh` is a one-shot idempotent VPS provisioner (Node + yt-dlp + ffmpeg + Nginx + SSL + systemd). Invoke as `sudo DOMAIN=... LE_EMAIL=... bash up.sh`. `update.sh` pulls + rebuilds + restarts. See [DEPLOY.md](DEPLOY.md).
- **"Done" gate:** a change ships only after `npm run build`, `npm run lint`, and `npm run typecheck` all pass clean.

---

## Architecture Map — the big picture

Everything is **registry-driven**: a handful of typed config objects in `src/lib/` are the single source of truth that generate pages, nav, sitemap, JSON-LD schema, and drive the engine. To add a platform/tool, edit the registry — not a dozen page files.

| Registry (`src/lib/`) | Drives |
|---|---|
| `platforms.ts` — `PLATFORMS` (11 platforms) | The `/[tool]` downloader pages, `/how-to/[platform]`, nav, sitemap, SSRF host whitelist, per-platform copy/FAQs. **`hostPattern` is the security source of truth.** |
| `aiTools.ts` — `AI_TOOLS` | `/video-to-text`, `/video-summary` pages |
| `converterTools.ts` — `CONVERTER_TOOLS` | `/video-to-mp3`, `/video-to-gif`, `/video-converter` |
| `imageTools.ts` — `IMAGE_TOOLS` | `/youtube-thumbnail-downloader`, `/tiktok-thumbnail-downloader` |
| `blog.ts` | Reads `content/blog/<platform>/<slug>.mdx` via gray-matter → `/blog`, `/blog/[category]`, `/blog/[category]/[slug]` |
| `site.ts` — `site`, `nav` | Brand, base URL (`NEXT_PUBLIC_SITE_URL`), all external/community/analytics config |

Per-platform copy is written **uniquely on purpose** (duplicate/templated content is a ranking killer). Don't collapse it into a template.

### The extraction engine (`src/lib/engine.ts`) — three backends, chosen by env

`extract()` (metadata + quality menu) and `prepareDownload()` (fetch one quality) select a backend at runtime:
1. **RapidAPI** (`RAPIDAPI_KEY`+`RAPIDAPI_HOST`) → `engine-api.ts`, returns **direct CDN URLs**; browser downloads from source = ~zero server bandwidth (the free/Vercel path). Adapt only `mapMedias()` if the API shape differs.
2. **Remote engine** (`ENGINE_URL`) → forwards extract/download to a separate service.
3. **Local yt-dlp** (default, self-host/dev) → spawns the `yt-dlp` binary with an **args array** (never a shell string), merges with ffmpeg when needed.

**The bandwidth rule:** the engine returns direct CDN links whenever possible. Only the local backend streams bytes through us (merge/watermark cases) — and it **streams to a temp file, never buffers**, caps `MAX_CONCURRENT_DOWNLOADS`, enforces `MAX_DOWNLOAD_MB`, and cleans up temp dirs on stream close/error.

### AI pipeline (`src/lib/ai*.ts`) — the "$0-forever" core

`aiPipeline.ts` orchestrates: yt-dlp extracts audio (`aiAudio.ts`) → transcribe (`ai.ts`, **Groq Whisper → Gemini fallback**) → chat/summary (Groq → Gemini fallback) → subtitles (`subtitles.ts` SRT/VTT). **Every step caches by content** (`aiCache.ts`) so a repeat URL never re-hits a provider. Providers are key-gated: no key → typed `AiError('not_configured', 503)`, never a crash. Secrets are server-only (`GROQ_API_KEY`/`GEMINI_API_KEY`).

### Client-side conversion (`src/lib/convert.ts`)

`/video-*` converters run **ffmpeg.wasm entirely in the browser** — the user's file never uploads (private + free). The ~32 MB wasm is dynamic-`import`ed so it loads only on converter pages, never in the main bundle.

### API routes (`src/app/api/`)

`extract` (POST, metadata) · `download` (stream a chosen quality) · `grab` (server-mode image/thumbnail via yt-dlp) · `ai/transcribe` + `ai/summary` · `contact` (nodemailer) · `og` (dynamic OG images) · `health`. All input-touching routes are `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, and follow the same guard order: **rate-limit → size-check → Zod parse → SSRF/host whitelist (`validate.ts`) → engine**, with typed `EngineError`/`AiError` mapped to correct HTTP status. Errors never leak internals to client or logs.

### Rate limiting (`src/lib/rateLimit.ts`)

Upstash sliding-window when configured, **in-memory fallback otherwise** so a bare VPS still has protection. Two buckets: default (20/60s) and a stricter AI bucket (6/60s) for the expensive transcribe/summary routes.

### Static-first rendering

All marketing/tool/blog/legal pages are SSG (`dynamic = 'force-static'`, `dynamicParams = false`, `generateStaticParams` from the registries). Only the `/api/*` routes are dynamic. `"use client"` lives only on the smallest interactive leaves (`DownloaderBox`, `ConverterBox`, `AiToolBox`, forms, install/PWA widgets). SEO metadata comes from `seo.ts` (`buildMetadata`) and `schema.ts` (JSON-LD builders); PWA via `manifest.ts` + `PwaRegister`; ads via `components/ads/` (`AdSlot` is CLS-safe and renders only when a network is configured).

### Browser extension

`snapvidly-extension/` (MV3) — one-click "open SnapVidly with this video's link". Content scripts match the 11 platform hosts. Standalone; not part of the Next.js build.

---

## Golden Rules (never break)

1. **Server Components by default.** `"use client"` only on the smallest interactive leaf. No page/layout is a client component.
2. **Static-first.** Marketing/tool/blog/legal pages are SSG. Only `/api/*` is dynamic.
3. **The bandwidth rule.** Return direct CDN links. Never stream/buffer video bytes through our servers unless a merge/watermark forces it — then stream to a temp file, never buffer.
4. **Secrets are server-only.** No secret in the client bundle, logs, URLs, or error text. Audit every `NEXT_PUBLIC_*`.
5. **Hostile input.** Whitelist URL hosts via `platforms.ts` `hostPattern` (SSRF), spawn yt-dlp with an **args array** (never a shell string), Zod-validate every request body, timeout every external call, rate-limit every input route.
6. **No database.** Content = MDX files. Community = Giscus + Discord. Rate-limit store (Upstash) is cache, not app data.

---

## Coding Standards — production grade

- **Strict TypeScript.** No `any`, no `@ts-ignore`, no non-null `!` to silence the compiler. Validate external data with Zod at the boundary.
- **Small, named, single-purpose** functions and components. Extract when a file does two jobs.
- **Real error handling.** Typed result + correct HTTP status on every async path. No empty catch, no swallowed errors, no crashes surfaced to users.
- **No dead code, no placeholders, no commented-out blocks.** Full, runnable files only.
- **Naming means something.** No `data`, `temp`, `handleClick2`.
- **Comments explain _why_,** not _what_. Match surrounding density.
- **Dependencies are a liability.** Justify every new package. Prefer the platform (fetch, Intl, CSS) — no moment/lodash/axios/CSS-in-JS.
- **Consistency over cleverness.** Match the existing registry-driven patterns.
- **Accessibility is part of "done":** semantic HTML, keyboard nav, focus-visible, ARIA on interactive controls, AA contrast, 44px touch targets.

---

## Design Standards — premium, restrained

Consult the `ui-ux-pro-max`, `design-system`, and `ui-styling` skills for grounded tokens before building UI; never invent random colors/spacing.

**Do:** one accent + neutral gray ramp + semantic states · 8px spacing scale · one/two radii, a 2–3 step shadow ladder · a real 5–6 step type scale, one self-hosted font, 60–75ch measure · whitespace as the premium signal, everything on-grid · design every state (default/hover/focus-visible/active/disabled/loading/error/empty) · subtle motion only (150–250ms ease, transform/opacity, respect `prefers-reduced-motion`) · mobile-first.

**Never (scream "vibe-coded"):** purple→pink gradients, glow/neon, rainbow buttons, emoji as UI icons · inconsistent spacing, off-grid elements, mismatched radii/shadows, centered walls of text · random arbitrary Tailwind values (`mt-[13px]`) · div soup · unlabeled icon-only controls · bouncy/confetti/autoplay motion, layout shift from late content.

Bar for every screen: **"Would a senior product designer ship this?"** If not, iterate.

---

## Performance Budget (hard gate)

Lighthouse ≥ 95 all categories · LCP < 1.5s · CLS < 0.05 · INP < 200ms · tool-page JS < 100 KB gzipped. A regression does not ship. (ffmpeg.wasm and any heavy dep must stay dynamic-imported and page-scoped.)

---

## Agents & Skills

**Agents** (`.claude/agents/`): `solution-architect`, `nextjs-architect`, `uiux-designer`, `downloader-engineer`, `seo-strategist`, `content-writer`, `security-auditor`, `performance-engineer`, `qa-test-engineer`.

**Mandatory gates before shipping:** `security-auditor` (anything touching input/engine/secrets) and `performance-engineer` (anything adding UI or deps).

**Skills:** design/UI (`ui-ux-pro-max`, `design-system`, `ui-styling`) · engine (`media-downloader`, `youtube-downloader`, `downloader-tiktok-videos`) · content (`content-writer` agent; `seo-blog-writer-constrained` skill for strict word-count/keyword formatting).

---

## Environment config

Base URL is `NEXT_PUBLIC_SITE_URL` (inlined at build; `build:pwa` re-points everything). Copy `.env.example` → `.env`. Engine selection: `RAPIDAPI_*` → `ENGINE_URL`/`ENGINE_KEY` → local `YTDLP_PATH`/`FFMPEG_PATH`. Hardening: `YTDLP_COOKIES`, `YTDLP_PROXY`, `MAX_CONCURRENT_DOWNLOADS`, `MAX_DOWNLOAD_MB`. AI: `GROQ_API_KEY`, `GEMINI_API_KEY` (+ model overrides). Rate limit: `UPSTASH_REDIS_REST_URL`/`_TOKEN` (falls back to in-memory). Never commit `.env`; ad keys in `.env` are preserved across `up.sh` re-runs.
