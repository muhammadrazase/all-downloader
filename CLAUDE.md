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
npm test             # vitest run — unit tests (test/*.test.ts), Node environment (no jsdom/canvas)
npm run test:watch   # vitest, watch mode
npm run test:e2e     # playwright test — full E2E suite (e2e/*.spec.ts), real Chromium
npm run test:tools   # playwright test e2e/allTools.spec.ts — fast registry-driven smoke test, every tool page
npm run test:all     # typecheck && lint && test && test:e2e — THE single command to deeply test everything, see below
npm run build:pwa <url>   # re-point the whole app to a base URL + build (scripts/build-pwa.mjs)
npm run indexnow     # ping IndexNow with sitemap URLs (scripts/indexnow.mjs)
npm run build:geo    # (re)build the self-hosted IPv4→country table for analytics (scripts/build-geo-db.mjs)
```

- **`postinstall` runs `scripts/copy-ffmpeg.mjs` and `scripts/copy-pdf-assets.mjs`** — copies `@ffmpeg/core` wasm into `public/ffmpeg/`, and the pdf.js worker + self-hosted Tesseract OCR core into `public/pdf/`/`public/ocr/`. If converter/PDF/OCR tool pages break after a fresh install, run these manually.
- **Deploy:** `up.sh` is a one-shot idempotent VPS provisioner (Node + yt-dlp + ffmpeg + Nginx + SSL + systemd). Invoke as `sudo DOMAIN=... LE_EMAIL=... bash up.sh`. `update.sh` pulls + rebuilds + restarts. See [DEPLOY.md](DEPLOY.md). `up-dev.sh` is the local-only counterpart: sets up a dev environment on Apple Silicon macOS (Homebrew Node, yt-dlp, ffmpeg) and optionally starts `npm run dev`.
- **"Done" gate:** a change ships only after `npm run build`, `npm run lint`, `npm run typecheck`, and (when it touches a tool) `npm run test:all` all pass clean.

### Testing every tool with one command — and keeping it current

`npm run test:all` is the single command that deeply tests every downloader, AI tool, converter, and PDF/file tool: typecheck → lint → all vitest unit tests → the full Playwright E2E suite. Real errors surface with a readable assertion message (which tool, which page, what was expected) via Playwright's `list` reporter — not a raw stack dump.

Two layers of E2E coverage, both under `e2e/`:
- **`e2e/allTools.spec.ts`** — registry-driven baseline smoke test. It imports all 6 tool registries directly (see the table below) and generates one test per tool: page loads (200), correct H1, canonical link, valid JSON-LD, no console/page errors, no mobile horizontal overflow. **A new tool added to any registry is covered here automatically, with zero code change.** A leading test asserts the total tool count equals `EXPECTED_TOOL_COUNT`; adding or removing a tool fails this loudly until that constant (and the count below) are updated deliberately.
- **Per-category deep specs** — `toolPages.spec.ts` (downloaders, registry-driven), `ai-tools.spec.ts`, `converters.spec.ts` + `converter-pages.spec.ts`, `pdf-tools.spec.ts`, `fileTools.spec.ts`. These exercise real functionality (an actual conversion, actual OCR, actual PDF output, byte-verified with an independent reader/ffprobe where relevant) and need a **new test added by hand** for each new tool's specific behavior — that can't be auto-derived the way the smoke test can.

**Whenever a tool is added, changed, or removed** (any registry in the table below):
1. Update `EXPECTED_TOOL_COUNT` in `e2e/allTools.spec.ts` (the test tells you the right number if you forget).
2. Update the tool count/list in this section.
3. Add or update a test in the relevant per-category deep spec for any new real behavior (the smoke test alone is not "deep" coverage for a new tool's actual functionality).

**Current tool count: 41**, across:

| Registry (`src/lib/`) | Count | Tools |
|---|---|---|
| `platforms.ts` — `PLATFORM_LIST` | 11 | TikTok, Instagram, YouTube, Facebook, LinkedIn, Twitter/X, Pinterest, Reddit, Vimeo, Twitch, Tumblr |
| `aiTools.ts` — `AI_TOOL_LIST` | 2 | video-to-text, video-summary |
| `converterTools.ts` — `CONVERTER_LIST` | 9 | video-to-mp3, video-to-gif, video-converter, video-trimmer, video-compressor, audio-trimmer, video-watermark, video-speed-changer, video-merger |
| `imageTools.ts` — `IMAGE_TOOL_LIST` | 2 | youtube-thumbnail, tiktok-thumbnail |
| `pdfTools.ts` — `PDF_TOOL_LIST` | 7 | merge-pdf, split-pdf, pdf-summary, pdf-editor, protect-pdf, unlock-pdf, pdf-to-jpg |
| `fileTools.ts` — `FILE_TOOL_LIST` | 10 | image-to-text, text-to-image, image-compressor, qr-code-generator, word-counter, heic-to-jpg, image-merger, social-media-resizer, qr-code-scanner, video-frame-grabber |

The 9 newest (video-compressor, audio-trimmer, video-watermark, video-speed-changer, video-merger, image-merger, social-media-resizer, qr-code-scanner, video-frame-grabber) were picked deliberately for high search/share potential with **zero AI and zero added server cost** — the video-* ones reuse the existing shared ffmpeg.wasm engine in `convert.ts` (no new dependency); image-merger/social-media-resizer/video-frame-grabber are pure Canvas 2D (no new dependency); qr-code-scanner adds one small zero-dependency package, `jsqr`, used only as a fallback (see below).

- **video-merger concatenates via ffmpeg's concat *filter*, not the demuxer** — clips can have mismatched resolution/codec, so each is scaled+padded to a common size (capped by its LONG edge, so a portrait clip's height can't slip through uncapped) and its audio resampled before splicing. The target size follows the **largest** clip, not upload order — otherwise reordering clips would silently change output quality. Limits are deliberately tighter than a single conversion (max 5 clips, 100MB each, 300MB combined) since every clip sits in the wasm heap at once. **Audio is all-or-nothing**: the merged output only gets an audio track if every input clip has one. Since there's no ffprobe.wasm bundled, per-clip resolution/audio-presence is read by running a throwaway `ffmpeg -i <name>` and parsing ffmpeg's own stream-info banner (`probeClip()`/`parseProbeOutput()` in `convert.ts`) — the parser is **anchored to lines starting with "Stream #"**, since ffmpeg prints a file's own `Metadata:` tags (title, comment, ...) before the real stream list, and an unanchored match let a crafted file's metadata (e.g. a comment reading "Video: 99999x99999") spoof the parsed resolution. Probes run strictly sequentially, since the log listener is shared on the one engine instance.
- **`execOrReset()` wraps every ffmpeg exec call** — a normal ffmpeg failure (bad input) resolves with a non-zero exit code, but `exec()` actually *throwing* means the wasm module itself aborted (e.g. OOM) and is unusable from then on; without resetting the cached singleton, every converter tool in the tab would keep failing until reload.
- **video-frame-grabber has no ffmpeg dependency at all** (`src/lib/videoFrame.ts`) — it seeks a `<video preload="metadata">` element and captures via `canvas.drawImage`, so its 500MB cap is far above the converters' 200MB (no re-encode cost to scale with size). `captureFrame()` waits out an in-progress seek first — capturing while `video.seeking` is true risks drawing the frame from before the seek, since `videoWidth`/`videoHeight` stay non-zero throughout.
- **video-speed-changer chains ffmpeg's `atempo` filter** for presets outside its native [0.5, 2.0] range (e.g. 4x becomes two `atempo=2.0` stages) — verified against a real silent fixture that `-af` is a graceful no-op (not an error) when the input has no audio stream, so no separate silent-video code path is needed.

- **qr-code-scanner tries the native `BarcodeDetector` API first** (Chrome/Edge/Samsung Internet, off-main-thread, zero bytes — same API this repo's own QR-generator E2E tests already use to verify a code round-trips) and only dynamic-imports `jsqr` as the Safari/Firefox fallback (`src/lib/qrScan.ts`). The jsQR path downscales to `MAX_SCAN_SIDE` (2000px) with `willReadFrequently` and `inversionAttempts: 'dontInvert'` before decoding — a full-resolution photo decoded and scanned pixel-by-pixel on the main thread was both a real hang risk (a small, non-huge PNG can decode to an enormous bitmap) and an INP violation for the live-camera loop, which also throttles to ~8 scans/sec.
- **The camera lifecycle uses a session/epoch counter (`sessionRef` in `QrScannerBox.tsx`), not just `cancelAnimationFrame`.** `startCamera`/`loop` are `async`, so a plain cancel can't reach an already-fired callback that's mid-`await` — without the epoch check, rapidly switching modes or retrying could leave a `getUserMedia` stream's tracks unstoppable (camera indicator stuck on) or spawn a second concurrent decode loop. Every exit path (unmount, mode switch, successful scan, a `play()` rejection) goes through `stopCamera()`, which bumps the epoch first.
- **`Permissions-Policy: camera=()` is scoped per-route in `next.config.mjs`**, not site-wide: `/qr-code-scanner` gets `camera=(self)`, everything else stays fully denied (the negative-lookahead route uses `/?` before its `$` — without it, `/qr-code-scanner/` would match both rules and emit two conflicting headers). A single site-wide `camera=()` (the pre-existing default) would silently break the camera feature in production — `getUserMedia` fails immediately with `NotAllowedError` regardless of what the page code does.
- **ffmpeg.wasm cleanup runs from `finally`, not just the success path**, across all five `convert.ts` functions (`convert`/`trim`/`trimAudio`/`compressVideo`/`addWatermark`) — a failed run used to leave its input (up to 200 MB) resident in the wasm virtual filesystem for the rest of the session.

(Live extraction against real third-party platforms is separately covered by `e2e/liveExtraction.spec.ts`, opt-in via `RUN_LIVE_E2E=1` — deliberately excluded from `test:all` since it hits real external sites and shouldn't run on every check.)

---

## Architecture Map — the big picture

Everything is **registry-driven**: a handful of typed config objects in `src/lib/` are the single source of truth that generate pages, nav, sitemap, JSON-LD schema, and drive the engine. To add a platform/tool, edit the registry — not a dozen page files.

| Registry (`src/lib/`) | Drives |
|---|---|
| `platforms.ts` — `PLATFORMS`/`PLATFORM_LIST` (11 platforms) | The `/[tool]` downloader pages, `/how-to/[platform]`, nav, sitemap, SSRF host whitelist, per-platform copy/FAQs. **`hostPattern` is the security source of truth.** |
| `aiTools.ts` — `AI_TOOLS`/`AI_TOOL_LIST` | `/video-to-text`, `/video-summary` pages |
| `converterTools.ts` — `CONVERTER_TOOLS`/`CONVERTER_LIST` | `/video-to-mp3`, `/video-to-gif`, `/video-converter`, `/video-trimmer` — client-side ffmpeg.wasm, see `convert.ts`. `kinds` is optional: a tool without it (the Trimmer) supplies its own box via `ConverterToolPage`'s `children` instead of the kind-picker `ConverterBox` |
| `imageTools.ts` — `IMAGE_TOOLS`/`IMAGE_TOOL_LIST` | `/youtube-thumbnail-downloader`, `/tiktok-thumbnail-downloader` |
| `pdfTools.ts` — `PDF_TOOLS`/`PDF_TOOL_LIST` | `/merge-pdf`, `/split-pdf`, `/pdf-summary`, `/pdf-editor`, `/protect-pdf`, `/unlock-pdf`, `/pdf-to-jpg` — client-side `@cantoo/pdf-lib`/pdf.js, see `pdfEngine.ts` |
| `fileTools.ts` — `FILE_TOOLS`/`FILE_TOOL_LIST` | `/image-to-text`, `/text-to-image`, `/image-compressor`, `/qr-code-generator`, `/word-counter`, `/heic-to-jpg` |
| `blog.ts` | Reads `content/blog/<platform>/<slug>.mdx` via gray-matter → `/blog`, `/blog/[category]`, `/blog/[category]/[slug]` |
| `site.ts` — `site`, `nav` | Brand, base URL (`NEXT_PUBLIC_SITE_URL`), all external/community/analytics config |

Per-platform copy is written **uniquely on purpose** (duplicate/templated content is a ranking killer). Don't collapse it into a template.

Each of the 6 tool registries has its own page shell (`[tool]/page.tsx`, `ConverterToolPage.tsx`, `ImageToolPage.tsx`, `PdfToolPage.tsx`, `FileToolPage.tsx`) and is mapped into `sitemap.ts`, `Navbar.tsx`, `Footer.tsx`, and `ToolsSection.tsx` (the `/tools` hub) automatically — adding an entry to a registry plus its page file is enough for full site-wide wiring. See "Testing every tool with one command" above for the required test updates when you do.

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

**Public read API** — `GET /api/tools` (all visible tools) and `GET /api/blog/posts` / `GET /api/blog/posts/[category]/[slug]` (visible posts, the latter with full MDX content) are the exception to "dynamic": no request data is read, so they stay eligible for Next's Full Route Cache (`revalidate = 3600` fallback), and the relevant admin Server Actions call `revalidatePath` on them for instant invalidation — see `src/lib/apiCache.ts` for the shared Cache-Control/ETag helper.

### Rate limiting (`src/lib/rateLimit.ts`)

Upstash sliding-window when configured, **in-memory fallback otherwise** so a bare VPS still has protection. Named buckets, each isolated so one can't starve another for the same IP: default (20/60s, extract/download/contact), a stricter AI bucket (6/60s) for the expensive transcribe/summary routes, admin-login (5/15min, on top of the account lockout), and track (60/60s) for the analytics beacon — kept separate from default because it fires on every one of the 32 tool-page visits and would otherwise burn a shared-IP visitor's extract/download budget just from browsing.

### Static-first rendering

All marketing/tool/blog/legal pages are SSG (`dynamic = 'force-static'`, `dynamicParams = false`, `generateStaticParams` from the registries). Only the `/api/*` routes are dynamic. `"use client"` lives only on the smallest interactive leaves (`DownloaderBox`, `ConverterBox`, `AiToolBox`, forms, install/PWA widgets). SEO metadata comes from `seo.ts` (`buildMetadata`) and `schema.ts` (JSON-LD builders); PWA via `manifest.ts` + `PwaRegister`; ads via `components/ads/` (`AdSlot` is CLS-safe and renders only when a network is configured).

### Browser extension

`snapvidly-extension/` (MV3) — one-click "open SnapVidly with this video's link". Content scripts match the 11 platform hosts. Standalone; not part of the Next.js build.

### Admin panel (`/admin`) — the one deliberate exception to "no database" / "static-first"

A single-superadmin, no-signup admin panel for runtime config that would otherwise require an `.env` edit + redeploy: hide/show any of the 32 tools (and blog posts), Groq/Gemini/RapidAPI/engine keys, Stripe config (storage only — no pricing model exists yet), community/site/analytics fields, and per-tool/per-post SEO overrides. This is a **narrow, deliberate exception** to Golden Rules 1/2/6 below, confined to `/admin/*` and a thin config-read layer the public pages call into — the public site's static-first architecture and performance budget are otherwise untouched.

- **Storage**: SQLite via `better-sqlite3` (no ORM), `data/admin.db` (gitignored, created lazily). Schema: `admin_user` (single row), `content_config` (visibility + SEO override, keyed by `(kind, key)` — covers all 6 tool registries AND blog posts), `settings` (generic KV, AES-256-GCM encrypted at rest for secrets), `audit_log`. See `src/lib/db/`.
- **Auth**: `src/lib/auth/` — scrypt password hash, HMAC-signed session cookie (no `jose`/`next-auth`). No signup; create/reset the one account with `npm run admin:create`. Brute-force defense is account lockout with exponential backoff (`adminUser.ts`) plus a per-IP rate-limit layer.
- **`middleware.ts` gates only `/admin/*`** (runs with `runtime: 'nodejs'`, reads SQLite for session validation). It does NOT gate tool/blog visibility — Next's Full Route Cache serves a `force-static` page's prerendered HTML directly and never invokes middleware for it (confirmed against a real `next build && next start`), so a middleware-based content gate silently never fires. Each of the 32 tool pages and the blog pages instead call `isContentEnabled()`/`redirect('/')` themselves at the top of the Server Component; the pages stay `force-static`, and an admin toggle's `revalidatePath('/', 'layout')` (in `src/app/admin/actions.ts`) forces Next to re-run that check and rebuild the cached page (as a real redirect response when disabled) before the next visitor sees it.
- **`/admin/tools` and `/admin/blog` SEO fields are pre-filled with the live copy, not blank overrides.** `src/lib/seoDefaults.ts` centralizes each tool's default keyword list (previously scattered as inline arrays across 21 page files) so both the page's own `generateMetadata()` and the admin form read the same source. Opening a tool's SEO panel shows its actual current title/description/keywords; saving — even unchanged — commits that into `content_config` as the new live value. There is deliberately no separate "current vs. override" duality in the UI.
- **Dynamic secrets**: `src/lib/config/settings.server.ts` — DB > env var of the same name > default, read fresh on every call (deliberately uncached — a `better-sqlite3` read is sub-millisecond, not worth a staleness footgun; `stmt()` in `db/index.ts` caches the *prepared statement*, which is where the real per-call cost was). `ai.ts`/`engine.ts`/`engine-api.ts` read keys through this (not module-level consts), so an admin-panel save takes effect immediately, no restart.
- **Every mutating Server Action calls `requireAdmin()` first** (`src/app/admin/actions.ts`). This is not belt-and-braces, it's load-bearing: Server Actions dispatch by action ID against *any* route that imports them — including the unauthenticated `/admin/login` page — so the `(dashboard)` layout's check only guards **rendering**. A security audit proved an unauthenticated POST to `/admin/login` could invoke every action (it took the public site down via `toggleMaintenanceModeAction`). `test/adminActions.test.ts` is the regression gate; never add a mutating action without the guard.
- **New env vars**: `SESSION_SECRET` (32+ chars, signs the session cookie), `CONFIG_ENCRYPTION_KEY` (64 hex chars, encrypts secrets at rest), `CRON_SECRET` (gates `/api/cron/*`), `TRUSTED_PROXY` (`1` behind nginx; set `0` only if exposed with no proxy, since `clientIp` would otherwise trust attacker-set headers and per-IP rate limiting becomes bypassable), optional `ADMIN_DB_PATH`. `up.sh` auto-generates the secrets idempotently.
- **`/admin/blog` does full CRUD** (`savePostAction`/`deletePostAction` in `actions.ts`), writing real MDX files under `content/blog/<category>/<slug>.mdx` (guarded by the same `SAFE_SEGMENT` path-traversal regex `blog.ts` already used for reads) rather than a database row — consistent with the "content = files" model. A post can be saved as a draft (`draft: true` in frontmatter, excluded from `getAllPosts`/sitemap/`generateStaticParams`) and published later; `/blog/[category]/[slug]` runs `dynamicParams = true` specifically so a newly published post renders on its first request with no rebuild. **Accepted trade-off, not an oversight:** MDX expressions compile to code that runs in the Node process with reach into `process.env` (verified: a post body can read `SESSION_SECRET`/`GROQ_API_KEY`/etc.). Before this feature, publishing required a reviewed git commit + redeploy; now a compromised admin session is direct RCE on the VPS, not just defacement. Acceptable for a single-superadmin site as long as the session cookie stays `httpOnly`/`sameSite: 'strict'`/`path: '/admin'` — do not relax those without revisiting this.

### Scale & caching (built for ~1M users on one VPS)

The load profile is lopsided and worth knowing before optimizing: **19 of the 32 tools run entirely client-side** (converters, PDF, OCR, QR, compressor, HEIC) and cost nothing but static bytes. Server load comes from 11 platform downloaders (`/api/extract`, `/api/download`) plus the 2 AI tools — 13 tools wide, not 32.

- **`src/lib/extractCache.ts`** — the highest-leverage cache in the app. `/api/extract` had `no-store` and zero dedup, so every request to a trending link cost a RapidAPI unit or a yt-dlp spawn. Now: TTL cache + **single-flight** (N concurrent requests for one link = 1 upstream call) + 60s negative caching for 404s. **TTL is by backend and load-bearing:** results carrying direct CDN URLs are *signed and expiring* → 12 min; a bare quality menu (local yt-dlp, no URLs) is immutable → 6h. The key normalizer is deliberately conservative (strips `utm_*`/`si`/`igsh`/etc., lowercases host, drops `www.`/`m.`) and does **not** guess per-platform video IDs — a wrong guess would collide two different videos and serve the wrong one.
- **Nginx (`up.sh`)** now serves `/_next/static/` and `public/{ffmpeg,ocr,pdf}` **from disk** with a `try_files … @app` fallback (previously every byte of the 32MB ffmpeg.wasm was proxied through Node), uses a keepalive upstream, `limit_req` on `/api/extract`, and a short `proxy_cache` on `/api/tools`/`/api/blog/posts`. `/api/download` stays unbuffered and uncached.
- **A CDN in front is the single biggest remaining win** and is not optional at high traffic — see DEPLOY.md. Put `/api/download` on a grey-clouded (proxy-off) hostname.
- **`revalidatePath` blast radius**: a visibility toggle legitimately invalidates all ~143 routes (nav/footer live in the root layout), and on-demand revalidation renders *blocking* on first hit per path — not stale-while-revalidate. Settings that don't appear in HTML (API keys, SMTP) are marked `affectsPages: false` and revalidate nothing. **Before adding a second Node process** you need a Redis `cacheHandler` in `next.config.mjs`: Next's ISR cache is per-process, so `revalidatePath` would only affect the process that handled the admin POST.
- Redis is deliberately **not** a dependency yet. At one Node process the in-process caches are fully effective and Upstash's REST round-trip (20–50ms) would tax every extract. When it's needed, self-host it on the box over a unix socket and swap `@upstash/*` for `ioredis`.

### AI free-tier strategy (`aiQuota.ts` / `aiAlerts.ts`)

Free Groq/Gemini tiers are a hard ceiling, so AI is the one deliberately soft-limited surface — the other 30 tools stay unconditionally free.

- **Daily budget per provider** (admin-editable, defaults 800 Groq / 1200 Gemini) recorded in the `ai_usage` table. Over budget or inside a 429 cooldown → that provider is skipped; when none are usable the user gets a typed `AiError('at_capacity', 503)` ("try again in a few hours") instead of a burnt quota or a confusing 502. Cached results keep serving.
- **Provider order is the caller's**, filtered by usability — never re-sorted. PDF summaries pass `preferProvider: 'gemini'` for a functional reason (1M-token context), and reordering that would silently truncate documents.
- **Do NOT pool multiple API keys per provider** to multiply quota. It's against both providers' terms and the downside is a ban that kills the feature permanently. This was tried and reverted deliberately.
- **Alerts**: `/api/cron/ai-quota` (secret-gated, installed as a daily cron by `up.sh`) emails `ALERT_EMAIL` when a provider passes 80% of budget or every provider is exhausted, and **repeats daily until resolved**; escalation to critical re-sends immediately. Status, budgets and a "send test alert" button live on `/admin/ai-keys`.
- Mail goes through one path (`src/lib/mailer.ts`, DB > env config) shared by the contact form and alerts.

### Analytics (`src/lib/analytics/`) — first-party, aggregate-only, no paid or account-gated service

`/admin/analytics` shows daily visitors, top tools, and top countries. Two deliberate constraints shaped this: (1) tool pages are `force-static` — no server code runs per visitor, so counting has to happen client-side via a beacon, not by instrumenting the page; (2) **nothing here may depend on a paid service or an account/EULA-gated "free tier"** — every dependency is either genuinely free forever or built in-house.

- **Write path never touches SQLite per request**: `<TrackView tool={slug}/>` (rendered once from each of the 6 tool-page shells, so it covers all 32 tools) fires a `navigator.sendBeacon` to `POST /api/track` on mount. The route only writes to an **in-memory** `Map` (`src/lib/analytics/collector.ts`); a 60s timer (plus a `SIGTERM`/`SIGINT` flush) batches it into `data/analytics.db` — a **separate SQLite file from `data/admin.db`**, so an analytics write can never queue behind an admin auth check. The flush-loop start guard lives on `globalThis`, not a module-level variable — Next's dev server can re-instantiate a route module without restarting the process, which was observed piling up duplicate `SIGTERM` listeners before this fix.
- **No per-event/per-visitor rows, ever** — only `tool_hits (day, hour, tool, country, hits)` and `daily_totals (day, visitors, pageviews)`. Daily uniques are counted via a same-day-only salted hash of ip+user-agent (`visitorHash()` in `collector.ts`) that's never written to disk and is unlinkable the moment the day rolls over — only the resulting count persists.
- **Country only, never city**, and **self-built, not MaxMind**: `npm run build:geo` (`scripts/build-geo-db.mjs`) turns the 5 Regional Internet Registries' own public "delegated-extended" allocation stats — no signup, no license key, no rate limit — into a sorted IPv4-range table (`data/geo-ipv4.json`, gitignored, refreshed monthly by a cron `up.sh` installs). IPv6 isn't covered (a stated scope cut); missing table or unresolvable IP → `'ZZ'`, same fail-open philosophy as the rest of this app's config reads. A visitor's IP is used only for that in-process lookup — never logged, never stored.
- **Retention**: `/api/cron/analytics-prune` (secret-gated like `/api/cron/ai-quota`, daily cron) deletes rows older than 400 days. Both cron routes accept the secret via the `x-cron-secret` header **only** — no query-string fallback, since that would leak into nginx access logs — and the cron scripts `up.sh` installs are `chmod 700` since they embed the secret in cleartext.
- **`flush()` snapshots before writing, and only clears in-memory state after the SQLite transaction commits** — clearing inside the transaction callback (the original implementation) meant a failed flush (disk full, `SQLITE_BUSY`) could roll back the DB write while the JS-side counters were already wiped, silently losing data. `test/analyticsCollector.test.ts` has a regression test that fails a later day's write on purpose and asserts an earlier day's pending data survives to the next flush.
- **`geo.ts` validates the shape of `geo-ipv4.json` after `JSON.parse`** (array of `[start, end, 2-letter country]`) and fails open to "no table" on anything else, and `warmGeoTable()` loads it once at module init instead of lazily on the first beacon, so the one-time ~100ms synchronous read happens at startup, not inside a visitor's request. `build-geo-db.mjs` caps each RIR fetch at 64MB and trims (rather than blindly concatenating) overlapping ranges from different countries, keeping the sorted-disjoint invariant `countryOf`'s binary search relies on.
- **Plausible/GA wiring bug fixed alongside this**: `/admin/site`'s `PLAUSIBLE_DOMAIN`/`GA_ID` fields wrote to `settings` but `src/components/Analytics.tsx` read build-time env vars and never saw them. It now takes `plausibleDomain`/`gaId` as props threaded from the root layout (DB > env), same pattern as the Navbar visibility props.
- **Explicitly not built**: real-time visitor counts, session replay, funnels/cohorts, referrer/UTM attribution, a chart library (the dashboard's chart is inline SVG) — this is a single-owner site on one VPS, not an analytics product.

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

Consult the `ui-ux-pro-max`, `design-system`, and `ui-styling` skills for grounded tokens before building UI; never invent random colors/spacing. A generated token reference for this project already exists at `design-system/snapvidly/MASTER.md` (colors, type, spacing) — check it before regenerating tokens from scratch.

**Do:** one accent + neutral gray ramp + semantic states · 8px spacing scale · one/two radii, a 2–3 step shadow ladder · a real 5–6 step type scale, one self-hosted font, 60–75ch measure · whitespace as the premium signal, everything on-grid · design every state (default/hover/focus-visible/active/disabled/loading/error/empty) · subtle motion only (150–250ms ease, transform/opacity, respect `prefers-reduced-motion`) · mobile-first.

**Never (scream "vibe-coded"):** purple→pink gradients, glow/neon, rainbow buttons, emoji as UI icons · inconsistent spacing, off-grid elements, mismatched radii/shadows, centered walls of text · random arbitrary Tailwind values (`mt-[13px]`) · div soup · unlabeled icon-only controls · bouncy/confetti/autoplay motion, layout shift from late content.

Bar for every screen: **"Would a senior product designer ship this?"** If not, iterate.

---

## Performance Budget (hard gate)

Lighthouse ≥ 95 all categories · LCP < 1.5s · CLS < 0.05 · INP < 200ms · tool-page JS < 100 KB gzipped. A regression does not ship. Every heavy client-side engine (ffmpeg.wasm, `@cantoo/pdf-lib`, `pdfjs-dist`, `tesseract.js`, `qrcode`, `fflate`, `heic-to`) must stay dynamic-imported and page-scoped, and self-hosted rather than loaded from a CDN — this app has no CSP configured, so a CDN-served dependency has no integrity backstop. `scripts/copy-*.mjs` (run on `postinstall`) is the established pattern for vendoring a new engine's worker/wasm/core assets under `public/`; `heic-to` (imported from `heic-to/csp`) needs no such script — verified (both by reading its source and by an E2E same-origin request check) to inline its entire worker and vendored libheif/wasm as a blob URL, with no separate asset fetch at all.

---

## Agents & Skills

**Agents** (`.claude/agents/`): `solution-architect`, `nextjs-architect`, `uiux-designer`, `downloader-engineer`, `seo-strategist`, `content-writer`, `security-auditor`, `performance-engineer`, `qa-test-engineer`.

**Mandatory gates before shipping:** `security-auditor` (anything touching input/engine/secrets) and `performance-engineer` (anything adding UI or deps).

**Skills:** design/UI (`ui-ux-pro-max`, `design-system`, `ui-styling`) · engine (`media-downloader`, `youtube-downloader`, `downloader-tiktok-videos`) · content (`content-writer` agent; `seo-blog-writer-constrained` skill for strict word-count/keyword formatting).

---

## Not part of the Next.js app

This working tree also contains a **separate, independent PHP/Laravel rewrite** in `laravel/` (its own `composer.json`, Docker stack, MySQL, admin CMS — see `laravel/README.md` and `laravel/DEPLOY-CPANEL.md`), built for PHP 8.2+ shared/cPanel hosting as an alternative deployment target. It shares no code, build, or runtime with the Next.js app described above — `npm` commands never touch it, and edits to `src/` never affect it. Treat it as a distinct project; don't mix its patterns into the Next.js codebase or vice versa unless the user is explicitly working on the Laravel port.

---

## Environment config

Base URL is `NEXT_PUBLIC_SITE_URL` (inlined at build; `build:pwa` re-points everything). Copy `.env.example` → `.env`. Engine selection: `RAPIDAPI_*` → `ENGINE_URL`/`ENGINE_KEY` → local `YTDLP_PATH`/`FFMPEG_PATH` — all admin-panel overridable (see above), `.env` is just the default when the DB has no value. Hardening: `YTDLP_COOKIES`, `YTDLP_PROXY`, `MAX_CONCURRENT_DOWNLOADS`, `MAX_DOWNLOAD_MB`. AI: `GROQ_API_KEY`, `GEMINI_API_KEY` (+ model overrides). Rate limit: `UPSTASH_REDIS_REST_URL`/`_TOKEN` (falls back to in-memory). Admin panel: `SESSION_SECRET`, `CONFIG_ENCRYPTION_KEY` (both auto-generated by `up.sh`), optional `ADMIN_DB_PATH`. Never commit `.env`; ad keys in `.env` are preserved across `up.sh` re-runs.
