# SnapVidly — Tier 3 Plan (Batch · Converter · Extension)

> **Goal:** ship power/UX features that differentiate SnapVidly, integrate cleanly into the existing Next.js app, and open big new SEO clusters — **free, no paid keys, skipping anything fragile.**
> **Lenses:** Solution Architect · Next.js Architect · SEO Strategist · UI/UX · Security.

---

## 0. Architect's summary (read first)

Three features, **three completely different integration patterns** — conflating them is the trap:

| Feature | Where the work runs | Server cost | Store review | Verdict |
|---|---|---|---|---|
| **Batch download** | Client orchestrates existing `/api/extract` | ~none (reuses engine) | — | ✅ easy, do first |
| **Format converter** | **`ffmpeg.wasm` in the browser** | **$0 — nothing leaves the browser** | — | ✅ elegant, high-SEO |
| **Browser extension** | Separate MV3 codebase + app landing page | ~none (deep-link, not API) | ⚠️ **Chrome may reject** | 🟡 do last, Firefox-first |

**Key architectural decisions:**
1. **Batch = client-side orchestration** over the existing extract API (thin, no new engine).
2. **Converter = `ffmpeg.wasm` client-side** — zero server bandwidth/CPU/storage, fully private, free. The file never leaves the user's browser.
3. **Extension = a smart deep-link shortcut**, not a direct API client — avoids CORS, API abuse, and most store-policy risk. Plus two **zero-review** "one-click" wins: **PWA `share_target`** and a **bookmarklet**.

**Constraints honored:** no paid keys, no paid services; the fragile/high-risk parts (server-side upload conversion, aggressive extension API) are explicitly cut.

---

## PART A — Batch download

### A.1 Feasibility — easy
Reuses the existing `/api/extract` (one call per link). No new engine, no new backend logic beyond a safety cap.

### A.2 Architecture (integration)
- **New page** `/batch-video-downloader` → renders a new client component `BatchDownloaderBox`.
- Flow: a **textarea** (one link per line) → parse lines → `detectPlatform()` per line (already exists) → a **client-side concurrency pool** (max 3 in flight) fires `POST /api/extract` per valid link → each result renders as a card (thumbnail, title, quality buttons — reusing the existing download flow) with a per-item status: `queued → fetching → ready → error`.
- **Abuse cap:** `MAX_BATCH = 20` links. Enforced client-side (reject extra lines) AND server-side (the per-IP rate limiter already throttles; add a note). No unbounded fan-out.
- **"Download all"** = trigger each ready item's top-quality download sequentially in the browser. **No server-side ZIP** (memory + bandwidth heavy) — explicitly skipped; per-item + sequential covers 99% of the need for free.

### A.3 Code contracts
```ts
// components/BatchDownloaderBox.tsx (client)
interface BatchItem {
  id: string; url: string; platform?: PlatformKey;
  status: 'queued' | 'fetching' | 'ready' | 'error' | 'unsupported';
  result?: ExtractResult; error?: string;
}
// A tiny concurrency pool (no dep):
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) { /* ... */ }
```
No changes to `/api/extract`. Optional: a `RATE_LIMIT_PER_MIN` bump note for batch users.

### A.4 SEO
- Page targets: **`bulk video downloader`**, `batch video downloader`, `download multiple videos`, `mass video downloader`, `download videos in bulk`.
- Metadata + `WebApplication` + `FAQPage` schema (reuse helpers), sitemap auto, internal links from nav/footer "Tools".

### A.5 Security / risks
- Cap (20) + existing per-IP rate limit + SSRF guard (per link, via existing `validateExtractTarget`) → no DoS via giant paste.
- Partial failures handled per-item (one bad link never breaks the batch).

### A.6 Effort: **~half day** code + short copy.

---

## PART B — Format converter

### B.1 The decision: `ffmpeg.wasm` **client-side**
Users convert **their own files** (or a just-downloaded file) entirely in the browser.
- **Why:** $0 server cost (no upload, no CPU, no storage, no cleanup), **fully private** (file never leaves the device), free — perfectly fits the constraints.
- **Trade-offs (and mitigations):**
  - Bundle ~25–30 MB → **lazy-loaded via dynamic `import()` only on converter pages**, and only when the user actually converts → **zero impact on the rest of the site's CWV**.
  - Slower than native + browser memory ceiling → **cap input at ~200 MB** and warn; fine for typical clips.
  - **Cross-origin isolation:** multi-threaded `ffmpeg.wasm` needs `COOP: same-origin` + `COEP: require-corp`, which would **break third-party embeds (your ads!)**. → **Use single-threaded `@ffmpeg/ffmpeg` (no COOP/COEP)** so ads/analytics keep working. Slightly slower, but no isolation headers, no ad breakage. *(Assumption: single-thread is the right call to protect ad revenue.)*

### B.2 Conversions offered (all in-browser)
- **Video → MP3** (audio extract)
- **Video → GIF** (fps + scale controls)
- **Resolution downscale** (1080p → 720p/480p)
- **MP4 ↔ WebM** (optional, later)

### B.3 Integration
- **New pages** (each a keyword cluster): `/video-to-mp3`, `/video-to-gif`, `/video-converter` (hub).
- New client component `ConverterBox`: drag-drop/file input → `dynamic import` of the ffmpeg module → run conversion → offer the result as a client-side `Blob` download (no server round-trip).
- ffmpeg core files self-hosted in `/public/ffmpeg/` (no external CDN → CSP-safe, no third-party dependency).

### B.4 Code contract
```ts
// lib/convert.ts — lazy, browser-only
export async function loadFfmpeg() { const { FFmpeg } = await import('@ffmpeg/ffmpeg'); /* self-hosted core */ }
export async function toMp3(file: File, onProgress: (p: number) => void): Promise<Blob> { /* ... */ }
export async function toGif(file: File, opts: { fps: number; width: number }): Promise<Blob> { /* ... */ }
```

### B.5 SEO — this is the biggest cluster
- **`video to mp3`, `mp4 to mp3`, `video to gif`, `convert video to mp3 online`, `video converter online`, `mp4 to gif`** — very high volume, and "online free converter" intent is winnable.
- Each page: metadata + `WebApplication` + `HowTo` + `FAQPage` schema, sitemap, internal links.

### B.6 Security / risks
- All processing is client-side → no server attack surface, no uploads to secure.
- Memory cap + progress UI + graceful failure on oversized files.
- Self-host ffmpeg core (no external script) to satisfy CSP and avoid supply-chain risk.

### B.7 Effort: **~1–1.5 days** (wasm wiring + 3 pages + copy).

---

## PART C — Browser extension (+ zero-review alternatives)

### C.1 The honest risk
A **Chrome Web Store** downloader extension **may be rejected** (Google's policy restricts media-download extensions — same spirit as the AdSense ban). **Firefox Add-ons** is more permissive. So: build it **store-agnostic**, ship **Firefox first**, submit Chrome knowing it may bounce.

### C.2 Architecture — a deep-link shortcut, NOT an API client
- **Separate MV3 repo** (`snapvidly-extension/`): a content script adds a **"⬇ Download with SnapVidly"** button on supported platform pages; clicking **opens `snapvidly.com/?grab=<encoded-url>`** in a new tab.
- **No direct API calls from the extension** → no CORS, no extension-driven API abuse, minimal permissions (`activeTab` + host match) → **easier review, safer.**
- App side: a small **deep-link handler** — the home/tool page reads `?grab=<url>`, auto-fills the box and auto-extracts.

### C.3 Zero-review "one-click" wins (do these FIRST — free, no store)
1. **PWA `share_target`** — add to the manifest so installed users can **Share → SnapVidly** from any app (YouTube/TikTok share sheet → SnapVidly opens with the URL). Native "one-click" on Android, **no store review, ~1 hour.**
2. **Bookmarklet** — a one-line bookmark that opens SnapVidly with the current page's URL. Works in any browser, **no review, ~1 hour.**

### C.4 App integration
- `?grab=<url>` deep-link handler (shared by extension, share_target, bookmarklet).
- Landing page `/browser-extension` (Software​Application schema) linking Firefox Add-ons + Chrome (when approved) + the bookmarklet.

### C.5 SEO
- `/browser-extension`, `/chrome-extension`, `/firefox-addon` — keywords `video downloader extension`, `chrome video downloader`.
- `SoftwareApplication` schema (ratings, price 0).

### C.6 Risks & effort
- Chrome rejection (mitigate: Firefox-first + deep-link design + bookmarklet fallback). Maintenance as platforms change DOM.
- Effort: **share_target ~1h · bookmarklet ~1h · extension ~2–3 days + review.**

---

## PART D — Unified integration & SEO surface

- **Routes added:** `/batch-video-downloader`, `/video-to-mp3`, `/video-to-gif`, `/video-converter`, `/browser-extension`.
- **Nav/Footer:** the existing **"Tools"** section (already built) gains these — full internal-link mesh, auto in sitemap.
- **Deep-link:** `?grab=` handler on home + tool pages.
- **Schema:** `WebApplication` (tools), `HowTo` (converters), `FAQPage`, `SoftwareApplication` (extension).
- **Manifest:** `share_target` added.

---

## PART E — Phased roadmap (production-level)

| Phase | Scope | Effort | Why first |
|---|---|---|---|
| **1** | **Batch download** page + `BatchDownloaderBox` (reuses engine) | ~½ day | Biggest quick win, zero engine risk |
| **2** | **Converter** — `ffmpeg.wasm` single-thread + `/video-to-mp3`, `/video-to-gif`, `/video-converter` | ~1.5 days | Huge SEO cluster, $0 server cost |
| **3** | **`share_target` + bookmarklet + `?grab=` handler** | ~½ day | Free "one-click", no store review |
| **4** | **Browser extension** (Firefox first; Chrome cautiously) + `/browser-extension` | ~2–3 days | Highest maintenance / review risk → last |

Each phase ends: `build` green, real functional test, sitemap/schema verified.

---

## PART F — Definition of Done (per feature)

- [ ] Feature works end-to-end (real test: batch 5 links, convert a real MP4→MP3/GIF, share_target opens with URL)
- [ ] No CWV regression (ffmpeg lazy-loaded; verify home bundle unchanged)
- [ ] Security: batch cap + rate limit + SSRF; converter is client-only (no upload surface)
- [ ] SEO: metadata + schema + sitemap + internal links (nav/footer Tools)
- [ ] Mobile + desktop UI verified
- [ ] Ads still load (no COOP/COEP isolation) — confirmed

---

## PART H — UX/UI design (every state)

Consistent with the existing design system (one accent, 8px scale, card + state machine). Reuses `DownloaderBox` patterns.

### H.1 Batch downloader UX
- **Input:** a large auto-growing `<textarea>` ("Paste links, one per line") + a live counter `n / 20`. Over the cap → the counter turns red and extra lines are ignored with an inline note. A "Paste" button reads the clipboard.
- **On submit:** the textarea collapses into a **result list**; each line becomes a **row card** with a per-item state machine:
  | State | UI |
  |---|---|
  | `queued` | muted row + small "Waiting…" |
  | `fetching` | spinner + "Fetching…" |
  | `ready` | thumbnail + title + quality buttons (same as single downloader) |
  | `error` | red inline reason + Retry button |
  | `unsupported` | grey "Unsupported link" (bad/duplicate URL) |
- **Header bar:** progress `"7 / 10 ready"` + a **"Download all (best quality)"** button (enabled once ≥1 ready; triggers sequential downloads with a 1s stagger so the browser doesn't block them).
- **Empty/again:** a "Clear" button resets to the textarea. Duplicate links de-duped with a subtle note.
- **A11y:** `aria-live="polite"` on the list; each row keyboard-focusable; status announced.
- **Mobile:** rows stack; quality buttons wrap; textarea full-width.

### H.2 Converter UX
- **Drop zone:** a large dashed card — "Drag a video here, or click to choose" (keyboard-accessible file input, `aria-label`). Shows the picked filename + size; rejects > 200 MB with a friendly message.
- **Options row (per tool):** MP3 (bitrate), GIF (fps + width slider), Resolution (target dropdown).
- **Convert states:**
  | State | UI |
  |---|---|
  | `idle` | drop zone + options + disabled "Convert" |
  | `loading-engine` | "Preparing converter…" (first-time wasm fetch, one-time) |
  | `converting` | **determinate progress bar** (ffmpeg progress %) + "Converting… keep this tab open" |
  | `done` | preview (audio player / GIF img) + **Download** (client Blob) + "Convert another" |
  | `error` | reason + retry |
- **Privacy reassurance line:** "Your file never leaves your device — conversion runs in your browser." (a real differentiator worth showing).
- **A11y/mobile:** progress bar has `role="progressbar"` + `aria-valuenow`; drop zone works via click on touch.

### H.3 Extension / share / bookmarklet UX
- `/browser-extension` page: hero + a **"Add to Firefox" / "Add to Chrome"** button pair, an animated GIF/screenshot of the in-page button, and a **"Copy bookmarklet"** one-click.
- **`?grab=` deep-link:** when present, the tool page auto-fills the box, shows a subtle "Imported from share" chip, and auto-runs extraction — a seamless "one-click" feel.
- **PWA share sheet:** installed users see "SnapVidly" in the OS share menu; tapping it opens the app pre-filled.

---

## PART I — SEO keyword map & cannibalization

| Page | Primary keyword | Secondary | Cannibalization |
|---|---|---|---|
| `/batch-video-downloader` | `bulk video downloader` | `batch video downloader`, `download multiple videos` | None (distinct intent) |
| `/video-to-mp3` | `video to mp3` | `mp4 to mp3`, `convert video to mp3 online`, `youtube to mp3`* | *YouTube-to-mp3 already served by the YT downloader → converter targets **generic file** conversion; keep H1 "convert your video file to MP3" to avoid overlap |
| `/video-to-gif` | `video to gif` | `mp4 to gif`, `convert video to gif` | None |
| `/video-converter` | `online video converter` | `free video converter`, `convert video online` | Hub page → links the two above; no overlap |
| `/browser-extension` | `video downloader extension` | `chrome video downloader extension`, `firefox video downloader` | None |

- **Rule enforced:** one primary keyword per page in title/H1/URL/first-100-words/one-H2 + FAQ schema.
- **Blog support (content-writer):** 1–2 posts per feature — e.g. "How to convert any video to MP3 free", "How to download multiple videos at once", "How to make a GIF from a video" — each links its tool page (topical authority + internal mesh).

---

## PART J — Security, cost & performance (hardened)

- **Batch abuse:** the 20-link cap is enforced **client AND server** — add a lightweight guard: `/api/extract` is per-IP rate-limited (exists); additionally the batch UI fires at most 3 concurrent and 20 total, and we document that the **rate limiter is the real backstop** (a scripted attacker hitting `/api/extract` directly is already throttled). No new DoS surface.
- **Converter cost:** **$0 server** (client-side wasm). **Deploy-size note:** ffmpeg core (~25–30 MB) is self-hosted in `/public/ffmpeg/`; it ships in the repo/build but is **only fetched by the browser on converter pages**, lazy, once (then HTTP-cached a year via the nginx immutable rule). It does **not** enter the main JS bundle → **home/tool CWV unchanged** (verify: home First-Load JS stays ~105 kB).
- **No cross-origin isolation:** single-thread ffmpeg.wasm means **no COOP/COEP headers**, so **ads and analytics keep working** — an explicit revenue-protecting decision.
- **CSP-safe:** ffmpeg core self-hosted (no external CDN script).

---

## PART K — Concrete code contracts (buildable)

### K.1 Batch — concurrency pool (no dependency)
```ts
// lib/pool.ts
export async function runPool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}
```
```ts
// BatchDownloaderBox: parse + cap + run
const links = [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))].slice(0, 20);
await runPool(links, 3, async (url, i) => {
  const p = detectPlatform(url);
  if (!p) return setItem(i, { status: 'unsupported' });
  setItem(i, { status: 'fetching' });
  const res = await fetch('/api/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, platform: p.key }) });
  const data = await res.json();
  setItem(i, res.ok && !('error' in data) ? { status: 'ready', result: data } : { status: 'error', error: data.error });
});
```

### K.2 Converter — lazy ffmpeg (self-hosted core, single-thread)
```ts
// lib/convert.ts  (browser only; dynamic import keeps it out of the main bundle)
let ff: import('@ffmpeg/ffmpeg').FFmpeg | null = null;
async function engine(onLog?: (m: string) => void) {
  if (ff) return ff;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  ff = new FFmpeg();
  if (onLog) ff.on('log', ({ message }) => onLog(message));
  const base = '/ffmpeg'; // self-hosted in /public/ffmpeg (single-thread core, no COOP/COEP)
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ff;
}
export async function toMp3(file: File, onProgress: (p: number) => void): Promise<Blob> {
  const f = await engine();
  f.on('progress', ({ progress }) => onProgress(progress));
  await f.writeFile('in', new Uint8Array(await file.arrayBuffer()));
  await f.exec(['-i', 'in', '-vn', '-b:a', '192k', 'out.mp3']);
  const data = await f.readFile('out.mp3');
  return new Blob([data], { type: 'audio/mpeg' });
}
export async function toGif(file: File, o: { fps: number; width: number }, onProgress: (p: number) => void): Promise<Blob> {
  const f = await engine();
  f.on('progress', ({ progress }) => onProgress(progress));
  await f.writeFile('in', new Uint8Array(await file.arrayBuffer()));
  await f.exec(['-i', 'in', '-vf', `fps=${o.fps},scale=${o.width}:-1:flags=lanczos`, '-loop', '0', 'out.gif']);
  const data = await f.readFile('out.gif');
  return new Blob([data], { type: 'image/gif' });
}
```
> Dep: `@ffmpeg/ffmpeg` + `@ffmpeg/util` (both free/MIT). Core `.wasm`/`.js` copied to `/public/ffmpeg/` at setup — **no external CDN**.

### K.3 `?grab=` deep-link handler (shared by extension / share / bookmarklet)
```ts
// In DownloaderBox: read the query param on mount and auto-run
useEffect(() => {
  const g = new URLSearchParams(window.location.search).get('grab');
  if (g && detectPlatform(g)) { setUrl(g); /* then trigger submit */ }
}, []);
```

### K.4 PWA `share_target` (manifest.ts) — zero-review "one-click"
```ts
// add to manifest.ts return object:
share_target: {
  action: '/',
  method: 'GET',
  params: { url: 'grab', text: 'grab', title: 'grab' },
},
```
Android reads shared text/URL into `?grab=` → the handler above auto-fills. No store, no review.

### K.5 Bookmarklet (one line, any browser)
```
javascript:location.href='https://snapvidly.com/?grab='+encodeURIComponent(location.href)
```

### K.6 Extension (MV3, deep-link only — minimal permissions)
```jsonc
// manifest.json
{ "manifest_version": 3, "name": "SnapVidly",
  "permissions": ["activeTab"],
  "content_scripts": [{ "matches": ["*://*.tiktok.com/*","*://*.youtube.com/*", "..."],
    "js": ["content.js"] }] }
```
`content.js` injects a button → `window.open('https://snapvidly.com/?grab='+encodeURIComponent(location.href))`. No API calls, no host-permission for our domain, review-friendly.

---

## PART L — Test matrix (per feature)

| Feature | Happy | Unhappy / edge |
|---|---|---|
| Batch | 5 mixed-platform links → all resolve | >20 lines (capped), duplicate lines (de-duped), 1 private link (per-item error, others ok), empty lines |
| Converter | real MP4 → MP3 plays; MP4 → GIF loops | >200 MB (rejected), non-video file (rejected), cancel mid-convert, engine load once then cached |
| share/grab | `?grab=<valid>` auto-fills + extracts | `?grab=<internal-ip>` → SSRF guard blocks; malformed → ignored |
| Extension | button opens app pre-filled | platform DOM change → button absent (graceful) |
| Ads/CWV | ads still load (no COOP/COEP); home JS ~105 kB | converter page wasm lazy — not in home bundle |

---

## PART G — Recommendation

Ship **Phase 1 (batch)** and **Phase 3 (share_target + bookmarklet)** first — they're cheap, free, and high-leverage. **Phase 2 (converter)** is the biggest SEO prize (video-to-mp3/gif are massive keywords) — worth the ffmpeg.wasm wiring, and the single-thread choice keeps ads working. **Phase 4 (extension)** last, Firefox-first, knowing Chrome may reject. Everything is **free, no paid keys, client-side where possible**, and integrates through the existing registry + Tools nav/footer.
