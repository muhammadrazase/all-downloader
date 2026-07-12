# SnapVidly Expansion Plan — New Platforms + Mini-Tools

> **Goal:** 2–3× the keyword footprint by adding video platforms + high-volume "mini-tool" downloaders — end-to-end, production-level.
> **Author lens:** Solution Architect · Next.js Architect · SEO Strategist · UI/UX · Content Writer
> **Status:** Plan (ready to implement in phases)

---

## 0. Architect's summary (read first)

There are **two very different workstreams** here, and conflating them is the main risk:

| Workstream | What it downloads | Engine | Effort |
|---|---|---|---|
| **A. New video platforms** (Twitter, Pinterest, Reddit, Vimeo, Tumblr, Twitch, Threads, Snapchat) | Video | **Existing yt-dlp path** — no engine change | Low (registry + copy + icons) |
| **B. Mini-tools** (thumbnail / profile-pic / story / photo grabbers) | **Images** | **New image-extraction path** + new UI | Medium (new type, route, component) |

**Recommendation:** Ship **A first** (fast, low-risk, big keyword win), then **B in phases** (higher value per page but needs new plumbing).

**The one architectural change that unlocks everything:** add a `kind` discriminator to the tool registry — `'video' | 'image'` — so one system drives both, and the UI/engine branch on it.

---

## PART A — New video platforms

### A.1 Feasibility (yt-dlp support + reality)

| Platform | yt-dlp | Difficulty | Search volume | Risk | Verdict |
|---|---|---|---|---|---|
| **Twitter / X** | ✅ | Easy | **Very high** | Low | ✅ Phase 1 |
| **Pinterest** | ✅ | Easy | **High** | Low | ✅ Phase 1 |
| **Reddit** (v.redd.it) | ✅ | Easy | High | Low (needs audio-merge via ffmpeg) | ✅ Phase 1 |
| **Vimeo** | ✅ | Easy | Medium | Low | ✅ Phase 1 |
| **Twitch** (clips/VODs) | ✅ | Easy | Medium-high | Low | ✅ Phase 1 |
| **Tumblr** | ✅ | Easy | Low-medium | Low | ✅ Phase 2 |
| **Threads** | ⚠️ partial | Medium | Growing | Medium (Meta, newer) | 🟡 Phase 3 (test first) |
| **Snapchat** | ⚠️ weak | Hard | High | **High** (ephemeral, spotlight-only) | 🔴 Defer / skip |

> **Assumption:** Reddit videos store audio separately → your existing ffmpeg merge already handles this. Snapchat stories are ephemeral/auth-gated — not worth the maintenance; only Spotlight is realistically doable.

### A.2 What each new platform needs (all in the registry — minimal code)

The current `PLATFORMS` registry already drives tool pages, sitemap, nav, SSRF whitelist, and schema. Each new platform = **one registry entry**:
1. `hostPattern` (SSRF whitelist) — e.g. `/(twitter\.com|x\.com)\//`
2. `brandColor` + **SVG brand icon** (add to `PlatformIcon.tsx`)
3. **Unique copy**: `metaTitle`, `metaDescription`, `h1`, `intro`, 4 `features`, `mobileSteps`, `pcSteps`, 4 `faqs` (content-writer — no duplication or Google penalizes)
4. `slug` (e.g. `twitter-video-downloader`, `pinterest-video-downloader`)

**Zero engine changes** — the extract route + yt-dlp already handle these hosts. The dynamic `[tool]` route auto-generates the page.

### A.3 SEO impact
- 6–8 new **exact-match tool pages** → 6–8 new keyword clusters (`twitter video downloader`, `pinterest video downloader`, `reddit video downloader`, …).
- Each auto-added to sitemap, nav, `WebApplication`+`FAQPage` schema.
- Add 1 "how-to" + 2–3 blog posts per platform later (content-writer) for topical depth.

---

## PART B — Mini-tools (image downloaders)

These are **not videos** — they need a new path. But they're the highest-ROI SEO plays (huge volume, big sites ignore them).

> **Scope note:** per the constraints, only the two **free, no-key, low-maintenance** thumbnail tools are IN scope (YouTube = no server; TikTok = light yt-dlp). The Instagram DP/photo/story rows below are documented for completeness but are **SKIPPED** (fragile / cookies / privacy risk) — see the 🔒 Scope Lock section.

### B.1 Feasibility

| Mini-tool | Method | Difficulty | Volume | Notes |
|---|---|---|---|---|
| **YouTube thumbnail downloader** | **Pure URL construction** (`i.ytimg.com/vi/<id>/maxresdefault.jpg`) | **Trivial — no server!** | **Very high** | Build first. All sizes (HD/SD). |
| **TikTok thumbnail / cover** | yt-dlp `thumbnail` field | Easy | High | Reuses engine |
| **Instagram DP / profile-pic (HD)** | Fetch profile → parse `profile_pic_url_hd` | Medium | **Huge (South Asia)** | May need occasional cookies |
| **Instagram photo / carousel** | Parse post → image URLs | Medium | High | Multiple images per post |
| **Instagram Story / Highlights** | Requires login cookies | **Hard** | High | Defer; cookie-gated |
| **Facebook Story** | Cookie-gated | Hard | Medium | Defer |

> **Key insight:** the YouTube thumbnail tool needs **zero backend** — you construct the image URL from the video ID entirely client-side. It's the cheapest possible high-traffic page.

### B.2 Architecture for mini-tools (the new plumbing)

1. **Registry discriminator** — extend the tool type with `kind: 'video' | 'image'` (+ an `imageKind: 'thumbnail' | 'profile' | 'photo'`).
2. **Response type** — add `ImageResult { title?, images: { label, url, width?, height? }[] }` alongside `ExtractResult`.
3. **Engine path**:
   - `thumbnail` (YouTube) → pure URL builder, no server call.
   - `thumbnail` (TikTok) → yt-dlp `--print thumbnail` (light).
   - `profile` / `photo` (Instagram) → a new extractor that fetches the public page/GraphQL and parses image URLs (server-side, SSRF-guarded, cached).
4. **New API route** `/api/grab` (image extraction) — mirrors `/api/extract` security (rate-limit, Zod, host whitelist) but returns images. YouTube-thumbnail can skip the server entirely.
5. **New UI** `ImageDownloaderBox` — shows image preview(s) + "Download" per size, instead of the quality menu.
6. **Routing** — mini-tools live at their own slugs (`youtube-thumbnail-downloader`, `instagram-dp-downloader`, …) via the same dynamic route, branching on `kind`.

### B.3 SEO impact
- 4–6 new pages targeting terms competitors ignore: `youtube thumbnail downloader`, `instagram dp downloader`, `instagram profile picture download`, `tiktok thumbnail`, `instagram photo download`.
- These often rank **faster** (lower competition) → your quickest traffic wins.

---

## PART C — Unified architecture (how it all fits)

```
Tool registry (kind: 'video' | 'image')
        │
        ├── video  → [tool]/page.tsx → DownloaderBox   → /api/extract → yt-dlp (existing)
        │
        └── image  → [tool]/page.tsx → ImageDownloaderBox → /api/grab   → image extractor (new)
                                                              └── youtube-thumbnail = pure URL (no server)
```

- **One registry, one dynamic route, two UI components, two engine paths.** Clean, DRY, extensible.
- SSRF whitelist, rate limiting, sitemap, schema, nav, icons all keep working automatically as you add entries.
- Security unchanged in shape: every new host added to the whitelist; `/api/grab` reuses the same guards.

---

## PART D — What could break (production realities)

- **yt-dlp coverage varies** — Twitter/Pinterest/Reddit/Vimeo/Twitch are stable; Threads/Snapchat are fragile → gate them behind a "beta" flag or defer.
- **Instagram image extraction is fragile** (Meta changes markup, may need cookies) → cache aggressively, degrade gracefully, reuse `YTDLP_COOKIES`.
- **Legal** — same disclaimer/DMCA posture applies; profile-pic/photo tools carry the same "download only what you have rights to" note.
- **Icons** — need real SVG brand marks for Twitter/X, Pinterest, Reddit, Vimeo, Twitch, Tumblr (extend `PlatformIcon.tsx`).
- **Content load** — ~14 new pages × unique copy + FAQs = real content-writer work (no templated duplication).

---

## PART E — Phased roadmap (production-level)

| Phase | Scope | Effort | Why |
|---|---|---|---|
| **1** | **6 video platforms**: Twitter/X, Pinterest, Reddit, Vimeo, Twitch, Tumblr — registry entries + brand icons + unique copy/FAQs | ~half day code + content | Biggest keyword win, zero engine risk, no keys |
| **2** | **Mini-tool infra** + **YouTube thumbnail** + **TikTok thumbnail** (new `kind:'image'`, `ImageDownloaderBox`; YT = no server) | ~1 day | Highest-volume, lowest-competition, $0 cost |
| **3** | **Blog + how-to pages** for the 8 new tools (content-writer) for topical depth + internal links | ongoing | Reinforce rankings |

~~Instagram DP/photo/story, Threads, Snapchat~~ — **removed** (fragile / cookies / paid-proxy risk). See Scope Lock.

Each phase ends with: `build` green, per-tool smoke test (real extraction), sitemap/schema verified.

---

## PART F — Definition of done (per new tool)

- [ ] Registry entry with unique, non-duplicated copy + 4 FAQs
- [ ] Brand SVG icon added
- [ ] SSRF host whitelist updated
- [ ] Real extraction verified (200 + correct media)
- [ ] Metadata + `WebApplication`/`FAQPage` schema + sitemap entry
- [ ] Mobile + desktop UI verified
- [ ] (Image tools) `ImageDownloaderBox` renders preview + download works

---

## PART H — Concrete technical design (code contracts)

This is what makes the plan buildable, not just strategic.

### H.1 Registry refactor — from union to discriminated tool type
Today `PlatformKey` is a hardcoded union and `PLATFORMS` is a `Record<PlatformKey, Platform>`. Adding platforms + image tools requires generalizing to a **tool registry**:

```ts
// lib/tools.ts  (supersedes the video-only PLATFORMS shape)
export type ToolKind = 'video' | 'image';
export type ImageKind = 'thumbnail' | 'profile' | 'photo';

export interface BaseTool {
  key: string;              // 'twitter', 'youtube-thumbnail', ...
  kind: ToolKind;
  name: string;             // 'Twitter / X'
  slug: string;             // 'twitter-video-downloader'
  keyword: string;          // primary target keyword
  brandColor: string;
  hostPattern: RegExp;      // SSRF whitelist source of truth
  urlExample: string;
  metaTitle: string; metaDescription: string; h1: string; intro: string;
  features: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
}
export interface VideoTool extends BaseTool { kind: 'video'; mobileSteps: string[]; pcSteps: string[]; }
export interface ImageTool extends BaseTool { kind: 'image'; imageKind: ImageKind; steps: string[]; }
export type Tool = VideoTool | ImageTool;

export const TOOLS: Tool[] = [ /* existing 5 + new entries */ ];
export const getToolBySlug = (slug: string) => TOOLS.find(t => t.slug === slug);
export const detectVideoTool = (url: string) => TOOLS.find(t => t.kind === 'video' && t.hostPattern.test(url));
```
> **Migration is backward-compatible:** keep `PLATFORMS`/`PlatformKey` as a derived subset (`TOOLS.filter(kind==='video')`) so existing pages, `PlatformIcon`, sitemap and schema keep working during the transition. `PlatformKey` stays the union of the original 5 for icon typing; new platforms use string keys with a fallback generic icon until a brand SVG is added.

### H.2 Image response contract
```ts
// lib/types.ts
export interface ImageAsset { label: string; url: string; width?: number; height?: number; ext: string; }
export interface ImageResult { source: string; title?: string; images: ImageAsset[]; }
```

### H.3 Engine paths (the important part)

**(a) YouTube thumbnail — ZERO server.** Pure client-side URL construction from the video id:
```ts
// lib/thumbnails.ts  — runs in the browser, no API call, no bandwidth
export function youtubeThumbnails(url: string): ImageAsset[] {
  const id = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)?.[1];
  if (!id) return [];
  const at = (q: string, ext = 'jpg') => `https://i.ytimg.com/vi/${id}/${q}.${ext}`;
  return [
    { label: 'Max HD (1280×720)', url: at('maxresdefault'), width: 1280, height: 720, ext: 'jpg' },
    { label: 'HQ (480×360)',      url: at('hqdefault'),     width: 480,  height: 360, ext: 'jpg' },
    { label: 'SD (640×480)',      url: at('sddefault'),     width: 640,  height: 480, ext: 'jpg' },
  ];
}
```

**(b) TikTok thumbnail** — light yt-dlp call: `yt-dlp --no-warnings --print thumbnail <url>` (reuses the engine, returns one direct CDN URL).

**(c) Instagram profile-pic / photo** — a new server extractor. Honest design:
- Fetch the public endpoint (`i.instagram.com/api/v1/users/web_profile_info/?username=…` with a UA + `x-ig-app-id` header, or the post's `?__a=1`/embed), parse `profile_pic_url_hd` / carousel `image_versions2`.
- **Requires** a realistic UA + app-id header; may need `IG_COOKIES` for reliability; **cache results 6–24h** (see H.5). Degrade to a clear "temporarily unavailable / private" message on failure.
- Returns **direct CDN URLs** — no image bytes through our server (see H.4).

### H.4 The image bandwidth rule (cost control)
Same principle as video: **return direct CDN URLs; the browser fetches from Instagram/YouTube CDN.** Server bandwidth ≈ 0.
- **Caveat:** the HTML `download` attribute is ignored cross-origin, so a click may *open* the image instead of saving it. Two options:
  1. **Default (free):** open in new tab + "long-press / right-click → Save" hint. Zero bandwidth.
  2. **Optional forced-download proxy** `/api/grab/file?u=…` that streams the image with `Content-Disposition: attachment` — **only for images** (tiny, KB-scale, unlike video), rate-limited, host-whitelisted. Cheap because images are small.
- **Recommendation:** ship option 1; add the tiny image proxy only if users complain. Images are KB, so even proxying is cheap — but default to direct.

### H.5 Caching (new requirement)
- **YouTube thumbnail:** none needed (client-side URL).
- **TikTok thumbnail / IG profile / IG photo:** cache the *extraction result* (the resolved CDN URLs, not the bytes) in the existing Upstash Redis (or in-memory fallback) keyed by the input URL, **TTL 6–24h**. This slashes yt-dlp/IG calls, avoids IP bans, and makes repeat requests instant.
- Add `Cache-Control: public, max-age=…` on `/api/grab` responses.

### H.6 `/api/grab` route (image extraction) — mirrors `/api/extract` security
```ts
// app/api/grab/route.ts  — runtime: nodejs
export async function POST(req) {
  // 1. rate limit (reuse checkRateLimit)
  // 2. Zod: { url, tool }  where tool ∈ image tools
  // 3. SSRF: validate host against the tool's hostPattern + private-IP block
  // 4. cache lookup (Redis)  → hit? return
  // 5. dispatch by imageKind: thumbnail | profile | photo
  // 6. cache set (TTL) + return ImageResult  (direct CDN urls)
}
```
> YouTube-thumbnail never hits this route — it resolves in the browser.

### H.7 UI — `ImageDownloaderBox`
Client component parallel to `DownloaderBox`:
- Same paste box + state machine (idle → validating → fetching → ready/error).
- On `ready`, render **image preview(s)** in a grid with a "Download" button per size/asset (each links to the direct CDN URL, `download` attr + `target=_blank`).
- For YouTube-thumbnail, skip the fetch entirely — build assets synchronously from the URL on submit.

### H.8 File-change checklist (per phase)
- `lib/tools.ts` (new registry) + keep `platforms.ts` as a derived video view.
- `components/PlatformIcon.tsx` — add SVG paths: Twitter/X, Pinterest, Reddit, Vimeo, Twitch, Tumblr (+ generic fallback for unknown keys).
- `lib/thumbnails.ts`, `lib/imageEngine.ts`, `app/api/grab/route.ts`, `components/ImageDownloaderBox.tsx`.
- `app/[tool]/page.tsx` — branch on `tool.kind` to render `DownloaderBox` vs `ImageDownloaderBox`.
- `lib/validate.ts` — extend whitelist; `sitemap.ts`/schema pick up new tools automatically.

---

## PART I — Keyword map & cannibalization (per tool)

| Tool | Primary keyword | Secondary | Cannibalization risk |
|---|---|---|---|
| Twitter/X | `twitter video downloader` | `x video downloader`, `download twitter video` | None (new cluster) |
| Pinterest | `pinterest video downloader` | `pinterest downloader`, `save pinterest video` | None |
| Reddit | `reddit video downloader` | `download reddit video with sound` | None |
| Vimeo | `vimeo downloader` | `download vimeo video` | None |
| Twitch | `twitch clip downloader` | `twitch vod downloader` | None |
| Tumblr | `tumblr video downloader` | — | None |
| YT thumbnail | `youtube thumbnail downloader` | `youtube thumbnail grabber`, `download youtube thumbnail` | **Distinct** from `/youtube-video-downloader` — different intent, no cannibalization |
| TikTok thumbnail | `tiktok thumbnail downloader` | `tiktok cover download` | Distinct |
| IG DP | `instagram dp downloader` | `instagram profile picture download`, `view instagram dp full size` | Distinct |
| IG photo | `instagram photo downloader` | `download instagram photo`, `instagram carousel download` | Distinct |

> **Rule enforced:** each tool page owns ONE primary keyword in title/H1/URL/first-100-words/one-H2 + FAQ schema. No two pages target the same phrase → no cannibalization.

---

## PART J — Legal & privacy (expanded)

- **Video/thumbnail tools:** same copyright disclaimer + DMCA as existing tools.
- **Profile-pic / photo tools carry an ADDITIONAL privacy dimension** — you're helping download images of *people*. Add explicit copy: "For personal use only. Do not use others' photos for impersonation, harassment, or commercial purposes. Only public content." This is both ethical and reduces liability/complaints.
- **Instagram tools** more aggressively violate Meta ToS and risk **IP bans** → caching (H.5) + optional proxy rotation (`YTDLP_PROXY` pattern) + graceful degradation are mandatory, not optional.

---

## PART K — Monitoring, rollback & beta-gating

- **Per-tool health:** extend `/api/health` to optionally probe a known-good URL per platform (or track recent success/failure rate) so you detect when a platform breaks.
- **Beta flag:** add `enabled?: boolean` (or `beta?: true`) to the tool registry. Fragile platforms (Threads, Snapchat, IG story) ship behind `NEXT_PUBLIC_ENABLE_BETA_TOOLS` — hidden from nav/sitemap until proven stable. Instant rollback = flip the flag, no redeploy of logic.
- **Graceful degradation:** every tool returns a typed "this platform is temporarily unavailable" state (never a crash) so one broken extractor doesn't look like a broken site.
- **Alerting:** wire `/api/health` to UptimeRobot; log per-tool success rate.

---

## PART L — Effort breakdown (realistic)

| Item | Build | Content (unique copy+FAQs) | Test |
|---|---|---|---|
| Registry refactor + generic icon fallback | 2h | — | 1h |
| 6 video platforms (entries + icons) | 2h | 3–4h (content-writer) | 2h |
| Mini-tool infra (`/api/grab`, `ImageDownloaderBox`, types, cache) | 4h | — | 2h |
| YT + TikTok thumbnail tools | 1h | 1–2h | 1h |
| IG DP + photo tools (extractor is the risk) | 4–6h | 2h | 2h |
> "Half day" in the roadmap = the *code*; content + testing add real hours. Budget accordingly.

---

## PART G — Recommendation

**Start with Phase 1 (6 video platforms).** It's a few hours, zero engine risk, **no keys, $0 cost**, and instantly grows your tool-page keyword footprint. Then Phase 2 (2 thumbnail tools) for the fastest-ranking, highest-volume mini-tools — the YouTube thumbnail tool needs no server at all.

**Net result:** 5 → **13 tool pages** = **~2.5× the organic surface area**, **zero new keys, zero extra cost, low-maintenance**, one clean DRY architecture. Everything fragile or paid was cut per constraints.

---

## 🔒 SCOPE LOCK — free + safe only (per constraints)

**Constraints:** (1) **no paid apps/keys** — nothing that costs money; (2) **skip anything difficult, fragile, or high-issue.**

### ✅ IN SCOPE (free, safe, no new keys, low-maintenance)
Everything below uses the **yt-dlp already on your VPS** — no API keys, no paid proxies, no new accounts:

| Tool | Why it's safe & free |
|---|---|
| **Twitter/X downloader** | yt-dlp native, stable, free |
| **Pinterest downloader** | yt-dlp native, stable, free |
| **Reddit downloader** | yt-dlp native (+ your ffmpeg merges audio), free |
| **Vimeo downloader** | yt-dlp native, stable, free |
| **Twitch clip downloader** | yt-dlp native, free |
| **Tumblr downloader** | yt-dlp native, free |
| **YouTube thumbnail downloader** | **Pure URL — no server, no key, no cost.** The single best tool here. |
| **TikTok thumbnail downloader** | Light yt-dlp `--print thumbnail`, free |

**Keys/apps required for all of the above: NONE.** No RapidAPI, no proxies, no paid services. Optional free Upstash for rate-limit caching (in-memory fallback already works without it).

### ❌ SKIPPED (fragile / ToS-risky / needs cookies or proxies — per "skip difficult")
| Skipped | Why |
|---|---|
| **Instagram DP / profile-pic** | Fragile Meta markup, often needs login cookies, IP-ban risk, privacy liability |
| **Instagram photo / carousel** | Same fragility + cookies |
| **Instagram / Facebook Story / Highlights** | Requires logged-in cookies — high maintenance |
| **Snapchat** | Ephemeral, spotlight-only, breaks constantly |
| **Threads** | Newer, partial yt-dlp support, unstable |

> Dropping these also removes the plan's biggest risks (IP bans, cookie management, privacy exposure) — so the surviving scope is **all-green, zero-cost, low-maintenance.** They can be revisited later if a free, reliable method emerges.

### Net (revised, honest)
5 → **13 tool pages** (5 existing + 6 new video + 2 thumbnail), **~2.5× keyword footprint**, **$0 extra cost, no new keys**, one clean architecture. This is the powerful-but-safe version.
