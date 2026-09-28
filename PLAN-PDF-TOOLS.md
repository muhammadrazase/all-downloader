# SnapVidly — PDF Tools Plan (Summarizer + Editor with OCR)

> **Goal:** add two PDF tools that fit the existing $0-forever, client-side-first, no-database architecture — a **PDF Summarizer** (AI) and a **PDF Editor with OCR** (page ops, add/replace content, OCR — entirely in the browser).
> **Review history:** v1 drafted, then independently reviewed by five expert lenses (solution-architect, security-auditor, performance-engineer, qa-test-engineer, seo-strategist) plus a hands-on technical spike in this exact codebase. This version incorporates every finding, including two corrections to the spike's own numbers and one mistake in v1's reasoning that two reviewers caught independently.

---

## 0. The one thing to decide before building: what "edit text" can honestly mean

You asked for: *"change text or anything, can add images, can add/remove table too — OCR to fetch text from PDF."* One technical fact shapes every decision below.

A PDF is not a document like Word — it has no paragraphs or reflow. Each page is a fixed sequence of low-level drawing instructions. No library, client-side or server-side, free or paid, can take arbitrary existing text and cleanly retype it — the original font is often a *subset* containing only the glyphs already used, so a new word needing an unused letter literally cannot be drawn in that font. Even Adobe Acrobat Pro's "Edit PDF" — decades of proprietary engineering — regularly mangles spacing on real-world PDFs.

**What every real consumer PDF editor (Smallpdf, PDFescape, Sejda, iLovePDF) ships, and what this plan builds:** *cover-and-replace* — draw an opaque box over old content, place new content on top. Visually indistinguishable from editing once exported; technically an overlay.

### ⚠️ This is not redaction — and the UI must never imply that it is

**Two independent expert reviews flagged this as the single highest-harm gap in v1 of this plan.** Covering text with a white box does **not** remove the original glyphs from the PDF's data. They remain fully recoverable — via copy/paste, `pdftotext`, or (worse) this project's own Summarizer feeding the "covered" page straight back through text extraction. A user who covers a salary figure, an SSN, or a name before sharing the file **has not removed it** — they've hidden it from casual viewing while leaving it byte-for-byte intact underneath.

**Non-negotiable before this ships:**
- The words **"remove," "redact," "delete,"** or "erase" must never appear in the UI for the cover-and-replace operation. Use "cover" / "hide" only.
- A persistent, dismissible-but-not-permanently-hideable warning wherever cover-and-replace is used: *"Covering hides content visually but does not remove it from the file. Do not use this to hide sensitive information you need genuinely removed."*
- Offer a real alternative for people who do need genuine removal: **flatten-to-image export** — render the finished page to a canvas via pdf.js, then re-embed it as a PNG via `embedPng`. This destroys the underlying text layer completely (the page becomes a picture of itself), which is slower and loses text-selectability, but is an honest "yes, this is actually gone" option.

**"Add text / image / table"** — genuinely real, no caveat. **OCR** — genuinely real, no caveat, independent of whatever's underneath.

If true content-stream rewriting is a hard requirement later, that's a commercial SDK (Nutrient/PSPDFKit, Apryse) with per-seat licensing — breaks the $0-forever model, called out as a non-goal.

---

## 1. Architecture split — two tools, two different trust tiers

| Tool | Fits the existing... | Privacy tier |
|---|---|---|
| **PDF Editor (+ OCR)** | `CONVERTER_TOOLS` pattern (`video-to-mp3`) | **Absolute.** File never leaves the device. The "processed in your browser, never uploaded" line every converter already makes stays 100% true. |
| **PDF Summarizer** | `AI_TOOLS` pattern (`video-to-text`) | **Not the same tier — say so.** Extracted *text* (not the file) is sent to a third-party AI provider. This is the same trust model as the existing video-summary tool (which sends a transcript, not the video), but it must be presented to users as a distinct tier from the Editor, not blurred together under one "100% private" banner. |

**Action item:** the Summarizer page needs its own explicit disclosure — "Text extracted from your PDF is sent to an AI provider (Google Gemini or Groq) to generate the summary. Your file itself is never uploaded, but the text it contains is." This also needs a line in `/privacy`. Gemini's free tier reserves rights over submitted content for product improvement — worth confirming current ToS terms before launch and deciding whether that's disclosed or whether Groq-primary avoids the question more cleanly (see §2).

Both are new registries alongside the existing ones — not a rework of anything shipped today.

---

## 2. PDF Summarizer

### 2.1 Flow — corrected: don't reuse the video-transcript truncation strategy

v1 proposed reusing `aiPipeline.ts`'s existing `budgetTranscript()` (head + tail, ~12k characters, built for spoken-video transcripts) unchanged. **This is wrong for documents.** A 300-page PDF has vastly more text than a 30-minute video transcript; truncating to 12k characters would silently summarize roughly the first-and-last 5% of the document while presenting the result as a complete summary — a real accuracy/trust failure, not a minor rounding error.

**Corrected approach:** for PDFs, prefer **Gemini's long-context path first** (its free tier supports approximately 1M tokens — enough to send most real-world documents whole, no chunking) with Groq as fallback only when Gemini is unavailable. `lib/ai.ts`'s `chat()` currently has no provider-preference parameter — this needs a small, explicit extension (a `preferProvider` option), not silent reuse.

```
user drops a PDF (client)
  → pdf.js extracts the text layer, page by page
  → any page with no extractable text (scanned/image page) → Tesseract.js OCR fallback for that page only
  → client assembles full document text
  → if text fits Gemini's context window: send whole (no truncation)
    else: apply head+tail budgeting as a last resort, and LABEL the summary as "based on the
    first and last portions of a long document" — never silently imply completeness
  → POST { text } to a new /api/ai/pdf-summary route
  → route calls chat() with preferProvider: 'gemini', a PDF-specific system prompt
  → cached by sha256(text) — same aiCache.ts, own namespace (see §5), same in-memory/Upstash fallback
```

### 2.2 New surface area

- `lib/pdfText.ts` — client-side extraction: pdf.js text layer + Tesseract.js fallback per page, returns `{ text, pageCount, ocrPagesUsed }`.
- `lib/ai.ts` — extend `chat()` with an optional `preferProvider` param; no other change to its existing behavior for video routes.
- `app/api/ai/pdf-summary/route.ts` — see §5 for the specific hardening this needs (it is *not* a copy-paste of `api/ai/summary/route.ts` — several details differ).
- Registry: `PDF_TOOLS['pdf-summary']` in `lib/pdfTools.ts`, same shape as `AiTool` minus URL-paste copy.
- Page: `/pdf-summary`.

### 2.3 What's different from the video pipeline (and why it's simpler)

No yt-dlp, no audio, no SSRF concern — input is a local file, so `validate.ts`'s host-whitelist doesn't apply. The risk surface shifts entirely to payload handling — see §5.2.

---

## 3. PDF Editor with OCR

### 3.1 What ships, precisely

| Capability | Real or overlay? | Library |
|---|---|---|
| Merge multiple PDFs into one | Real | `@cantoo/pdf-lib` |
| Split / extract page ranges | Real | `@cantoo/pdf-lib` |
| Reorder, rotate, delete pages | Real | `@cantoo/pdf-lib` |
| Add new text, anywhere | Real | `@cantoo/pdf-lib` (draw) via canvas UI |
| Add an image | Real | `@cantoo/pdf-lib` (embed) via canvas UI |
| Add a table | Real (a positioned grid of lines + cell text) | `@cantoo/pdf-lib` (draw) via canvas UI |
| "Edit"/cover existing text or images | **Overlay only — not redaction, see §0** | `@cantoo/pdf-lib` (draw) via canvas UI |
| Remove a table/object the user placed this session | Real delete (a tracked object, not baked into the page yet) | canvas UI state |
| "Remove" *original* page content | Overlay (opaque cover) or flatten-to-image for genuine removal | `@cantoo/pdf-lib` |
| OCR: scanned PDF → extracted text | Real | `tesseract.js` |
| OCR: scanned PDF → new searchable PDF | Real — check whether `tesseract.js` can emit this directly before hand-rolling an invisible text layer (pdf-lib has no `setTextRenderingMode` exposed) | `tesseract.js` (+ `@cantoo/pdf-lib` if hand-rolled) |

**Scope limits to state honestly up front, not discover mid-build:**
- **Non-Latin text cannot be added via "Add text"** in v1. `@cantoo/pdf-lib`'s built-in `StandardFonts` only cover WinAnsi — `drawText` throws outside that range. Full Unicode support needs a fourth dependency (`@pdf-lib/fontkit` + an embedded font like Noto, several MB) and is out of scope for v1. Error clearly rather than silently mangling text. Consistent with this app being English-only today (no i18n routing exists — confirmed in `site.ts`/`seo.ts`).
- **Encrypted and digitally-signed PDFs are refused, not silently corrupted.** `@cantoo/pdf-lib` cannot safely open encrypted PDFs, and re-saving a signed or AcroForm-bearing PDF can silently invalidate the signature/form. Detect both cases at file-open time (pdf.js reports encryption; check for `/Perms`/`/UR` dictionary entries) and show a clear "this PDF can't be edited here" message — never a corrupted silent output.

### 3.2 Libraries — corrected choices and sizes

- **`pdfjs-dist`** (Apache-2.0, Mozilla) — page rendering + text layer extraction. **Pin `^6.3.289` or later** — the unpinned default resolves into a range with a published high-severity CVE for arbitrary JS execution on a malicious PDF (GHSA-hq66-cqwq-w95j), caught by the spike. Re-check this pin at implementation time.
- **`@cantoo/pdf-lib`** (MIT) — **not** the original `pdf-lib` (Hopding/pdf-lib), confirmed effectively unmaintained. The fork has an identical API and was still shipping releases as of this check.
- **`tesseract.js`** (Apache-2.0) — WASM OCR. **Pin the core and language build explicitly — do not let it feature-detect.** See §3.3 for why this matters: it's the difference between a ~6.5 MB one-time download and the ~22 MB the first spike measured by accident.

No canvas/annotation library is added as a fourth dependency — see §3.4.

### 3.3 Verified via spike, then corrected by expert review — read this before estimating anything

A throwaway spike was built in this exact codebase (Next.js 15.1.6, **plain webpack** — this app does not use Turbopack), run in real Chromium via Playwright, then deleted. The raw results were then reviewed by a solution-architect and a performance-engineer, who each caught a real problem with the spike's own numbers. Both corrections are recorded here because the original run is gone and future work needs to trust *this* table, not the first draft.

| Question | Spike result | Expert correction |
|---|---|---|
| Does pdfjs-dist's worker load under this app's webpack config? | **Yes, no errors.** Rendered a page to canvas, extracted exact text back. | Holds. |
| Does `@cantoo/pdf-lib` create/merge/embed-image/draw/round-trip work? | **Yes**, including re-opening the mutated output with pdf.js afterward — valid, correct page count, not corrupted. | Holds. |
| Does `npm run build` succeed, and do the libraries leak into the shared bundle? | **Yes** clean build; tool page First Load JS was 108 KB — identical to a plain content page. Dynamic `import()` kept all three out of the initial load. | Holds — but a CI bundle-size gate (`scripts/check-bundle.mjs` asserting First Load JS ≤ 100 KB per `/pdf-*` route) should be added so the first careless top-level import doesn't silently regress this. None exists yet for any route in this app. |
| **How much does OCR cost on first use?** | Measured **~22 MB download, ~33.5 seconds.** | **This number is wrong, and it's wrong for a specific, fixable reason: the spike let tesseract.js feature-detect and fetch multiple WASM core variants instead of one.** `tesseract.js-core@6`'s actual largest single-purpose artifact (the SIMD+LSTM-only build, which is all this feature needs) is **~2.9 MB**, and English trained data via the `tessdata_fast` set (not the default set) is **~2 MB**, not 10–15 MB. Pin `corePath` to the SIMD-LSTM build and `langPath` to `tessdata_fast` explicitly. **Corrected real number: ~5.4 MB total, ~5–8 seconds on typical connections.** Re-measure this in a real spike before writing any progress-UI copy — do not build a UX around either the old or the new number without re-verifying, since this was wrong once already. |
| Does OCR accuracy hold up? | 6/6 tokens matched, 95% confidence — on one small, clean, synthetic test image. | **Not evidence of real-world readiness.** A single clean synthetic image proves the pipeline works, not that accuracy claims are safe to publish. See §6 for the actual acceptance bar. |
| Is per-page OCR timing representative? | Not separately measured — only the tiny synthetic image was timed. | **Solution-architect correction: a realistic 300-DPI scanned page is 1.5–4 seconds to OCR, not ~150ms.** A 500-page scanned document is **15–30 minutes**, not the ~90 seconds v1's numbers implied. This changes the UX materially — see §3.5. |
| Does memory return to baseline between OCR'd pages? | **Yes, on desktop Chrome** — flat ~69 MB across 3 create-worker→recognize→terminate cycles. | Correct as measured, but **incomplete as a safety proof**: real risk is decoded-pixel memory from rendering, not just the OCR worker (see §3.4). **iOS Safari was never tested on a real device** — required before launch, not optional (see §6). |

### 3.4 Client-side resource limits — corrected: bound by pixels, not file bytes

Performance review found three unaccounted crash points that v1's "50 MB file size guardrail" does not cover, because **memory is bound by decoded pixels, not file size on disk.** A 100-page, 300-DPI scan can be under 30 MB on disk while each rendered page occupies 15–25 MB of RGBA memory.

**Corrected limits:**
- `pdfjs-dist`'s `maxCanvasPixels` capped at 4,000,000 on viewports under 768px wide. (iOS Safari's own hard canvas ceiling is ~16.7M pixels — do not approach it.)
- **Page-count cap**, not just a file-size cap: soft-warn above 100 pages; batch OCR-all in runs of 25 pages.
- **Mobile file cap of 20 MB**, desktop 50 MB — not one number for both.
- Cap render scale at `min(devicePixelRatio, 2)`.
- Virtualize the **thumbnail rail**, not just the main page view — v1 only virtualized main pages; 100 thumbnails is another 10+ MB.
- **React unmounting a canvas does not free its backing store on iOS Safari.** Explicitly set `canvas.width = canvas.height = 0` on eviction — this is a specific, easy-to-miss leak, not a generic "clean up on unmount" note.
- **`pdfDoc.save()` is an unaccounted OOM point.** `@cantoo/pdf-lib` serializes the entire document into one `Uint8Array` in memory — on a 50 MB input with embedded images, this can peak over 100 MB *while page canvases are still mounted*. Unmount every page canvas before calling `save()`, and use `save({ useObjectStreams: true })`. **This, not OCR, is the most likely actual cause of an iOS tab kill** — design and test for it explicitly.

### 3.5 Interaction performance (INP) — specific implementation constraints

The no-fourth-dependency DOM-overlay approach (§3.6 below) is confirmed correct, but three specific traps must be designed around from the start, not discovered in profiling later:
1. **Drag/resize must mutate `style.transform` directly inside `pointermove`**, committing to React state only on `pointerup`. One `setState` per pointer move with 50+ overlay objects on the page will blow the 200ms INP budget.
2. **pdf.js parses in a worker but rasterizes on the main thread.** A 2×-DPR page paint is 150–500ms and will register as the page's INP event on every page-change or zoom. Cancel in-flight `RenderTask`s on rapid navigation; keep the previous canvas visible until the new one resolves, rather than blanking to empty.
3. **OCR's `getImageData` + structured-clone of a ~15 MB buffer into the Tesseract worker runs on the main thread.** Transfer the underlying `ArrayBuffer` (or pass a `Blob`) instead of letting the browser clone it synchronously.

CLS risk is lower than it first appears (browsers exclude post-interaction shifts within 500ms of input from CLS scoring), but reserve the page container's aspect ratio from the PDF's MediaBox the moment `getPage()` resolves, and keep the toolbar height constant across tool modes.

### 3.6 The editing surface: build it on pdf.js's canvas, not a new canvas framework

No generic canvas/annotation library (Fabric.js, Konva) is added. Text boxes, image placeholders, and table grids are plain absolutely-positioned DOM elements over the pdf.js `<canvas>`, walked and drawn onto the real page via `@cantoo/pdf-lib` on export. Confirmed sufficient for drag/resize/type/delete without a scene-graph dependency — see §3.5 for the specific performance discipline this requires.

### 3.7 UX design for the corrected OCR cost

Even at the corrected ~5–8 second first-use cost (not 33.5s), this is still a real, noticeable wait the first time any visitor uses OCR — design for it explicitly, don't let it be a silent hang:
- **Do not prefetch on hover.** Fetching 5+ MB speculatively on a hover event burns real mobile data for users who bounce without using the tool.
- Prefetch only the small pieces on drop-zone `pointerenter` (pdf.js worker + pdf-lib, ~600 KB combined) — cheap enough to speculate on.
- Fetch the OCR core itself only once file-drop confirms real intent, and only when `navigator.connection.saveData !== true`.
- At ~5–8 seconds, a determinate byte-progress bar ("Downloading OCR engine — 3.1 / 5.4 MB, one time only") is sufficient. No cancel/escape hatch needed below ~10 seconds.
- **Set separate, honest expectations for per-page OCR time on multi-page documents** using the corrected 1.5–4s/page figure — a progress indicator that says "page 12 of 40" is honest; a spinner that could mean anything for half an hour is not.

### 3.8 New surface area

- `lib/pdfEngine.ts` — thin wrapper around `@cantoo/pdf-lib` operations, mirroring how `lib/convert.ts` wraps ffmpeg.
- `lib/pdfOcr.ts` — Tesseract.js wrapper with pinned `corePath`/`langPath` (§3.3), one-page-at-a-time worker lifecycle (§3.4).
- `lib/pdfTools.ts` — registry, same shape as `converterTools.ts`.
- **Two separate client components, not one giant one with a mode prop.** v1 proposed `/pdf-editor`, `/ocr-pdf`, `/merge-pdf`, `/split-pdf` all sharing one `PdfEditorBox` in "reduced mode" — performance review correctly points out this gives **zero code-splitting benefit**, since a `mode` prop still ships the whole component. `/merge-pdf` and `/split-pdf` are also the plan's highest-search-volume pages (§4) and need only `@cantoo/pdf-lib` — no pdf.js rendering, no Tesseract. Build:
  - `components/PdfEditorBox.tsx` — the full interactive editor (view/annotate/add-content/OCR/cover-and-replace). Large; expect sub-components (toolbar, page canvas, overlay object, thumbnail rail).
  - `components/PdfQuickToolsBox.tsx` — a small (~30 KB), separate component for merge/split/rotate-only, used by `/merge-pdf` and `/split-pdf`.
- Keep each tool page's shell server-rendered (matching `ConverterBox`'s existing pattern: a `'use client'` leaf that still emits real markup via SSR) — do **not** wrap the whole page in `next/dynamic({ ssr: false })`, or the drop zone disappears from the SSR'd HTML and LCP becomes JS-dependent. Dynamic-import the *libraries*, never the page shell.
- **No `AdSlot` inside or directly above the interactive editor surface.** `AdSlot` is CLS-safe, but an ad script re-laying-out while a user is mid-drag on an overlay object is a direct INP hit on a working surface. Keep ads only in SEO content below the fold on these pages, and suppress ad-slot hydration once a document is actually open.

---

## 4. Server-load minimization strategy

| Surface | Load on your server | Strategy |
|---|---|---|
| The Editor itself | **None.** No upload endpoint exists. | Nothing to minimize. |
| Library code (pdfjs-dist, pdf-lib, tesseract.js) + OCR assets | Bandwidth, once per visitor, then cached | **Self-host from `node_modules`, matching the existing ffmpeg.wasm precedent exactly** — see the security note below for why this beats the CDN idea in v1. |
| The Summarizer's AI call | One text-completion request per uncached document | Cache by `sha256(text)` (own namespace — see §5.4), hard byte cap before parsing, no PDF handling of any kind server-side. |
| Rate limiting | Protects the one real endpoint | Reuse `checkAiRateLimit` — no new infrastructure. |

### Correction: self-host, don't CDN-load — but for a more specific reason than "safety"

v1 recommended loading these libraries from jsDelivr/unpkg specifically to save server bandwidth, reasoning it was "the same trust model as loading a font from Google Fonts." **Two independent reviews (security, solution-architect) caught that this reasoning is wrong**, and a third (performance) added the resolving nuance:

- A font is inert data; `pdfjs-dist`/`tesseract.js` are executable JS and WASM served into your own origin. A CDN URL not pinned to an exact, SRI-verified version means the `pdfjs-dist ^6.3.289` fix for the malicious-PDF CVE **controls nothing at runtime** — a floating tag on the CDN could silently reintroduce it.
- This app has **no Content-Security-Policy configured today** (confirmed directly in `next.config.mjs`) — there's no existing hardening layer that would catch a compromised or drifted CDN asset.
- This is also a direct precedent break: this repo already self-hosts a much larger dependency (ffmpeg.wasm, ~32 MB) via `scripts/copy-ffmpeg.mjs` specifically to avoid exactly this class of risk.
- **Performance review's contribution: self-hosting isn't automatically "solved" either — there's a real, pre-existing, unrelated bug worth fixing at the same time.** This project's self-hosted `/public` assets (including ffmpeg.wasm today) are served with Next's default `max-age=0`, and are **not** covered by the nginx `location /_next/static/` immutable-caching rule — meaning the existing 32 MB ffmpeg.wasm is being needlessly revalidated on every visit right now. Fix that caching gap as part of this work (add an explicit long-lived `Cache-Control: public, max-age=31536000, immutable` header for `/public` static library assets), and self-hosting the new PDF/OCR assets gets the same "fetch once, cache forever" behavior the CDN would have offered, with none of the version-drift risk.
- With the corrected OCR size (§3.3, ~5.4 MB not ~22 MB), estimated egress at 1,000 first-time-OCR users is roughly **5.4 GB**, not the ~22 GB v1's number implied — trivial for any host, including a bare VPS, once the caching header is fixed.

**If bandwidth cost genuinely becomes a concern at scale later**, the CDN path remains valid as a fallback *if and only if* done with exact version pins (never `@latest`), Subresource Integrity hashes on every script entry point, a `preconnect` injected only on real user intent (not site-wide in `<head>`), and a self-hosted fallback path for CDN-outage resilience. Self-hosting is simpler and is the recommended default; this is documented as the alternative, not the plan.

---

## 5. Security & privacy — full findings

### 5.1 Editor (client-side only)

- **pdf.js hardening flags — name these explicitly at implementation time, don't rely on defaults:** `getDocument({ data, isEvalSupported: false, enableXfa: false, useSystemFonts: false })`. Always pass `data:` (raw bytes), never `url:` — the latter reopens a fetch-based attack surface for no benefit here, and disabling XFA closes an XML/XXE-style path.
- **Never hand-roll the annotation/link layer without a protocol whitelist.** A PDF's `/URI` action can contain a `javascript:` URI, and `/Launch` actions exist — both become same-origin XSS if rendered as clickable links without filtering. Whitelist `http:`, `https:`, and `mailto:` only.
- **Resource bombs beyond file size:** page-count cap (~500), a per-page render timeout with `AbortSignal`, and the canvas pixel cap from §3.4. OCR must terminate its worker in a `finally` block, not just on the happy path.
- **Metadata stripping should be default-on, with an opt-out — not opt-in as v1 proposed.** For a tool positioned on privacy, defaulting to *keeping* potentially sensitive producer/author metadata is the wrong default. Also: clearing the PDF's Info dictionary is **not sufficient** — `@cantoo/pdf-lib` preserves the document catalog's separate XMP metadata stream independently. Strip both.

### 5.2 The new `/api/ai/pdf-summary` route — specific hardening, not a copy-paste of the video route

- **`Number(request.headers.get('content-length') ?? 0)` is bypassable** — it's `0`/absent for chunked-encoding requests, meaning a naive port of the existing size check does nothing and `req.json()` buffers unbounded. **Read the body with a hard byte ceiling (reject over ~256 KB) before parsing it as JSON**, not after.
- Schema: `z.object({ text: z.string().min(200).max(60_000) }).strict()` — and **do not accept a `filename` field at all.** v1's draft schema included one; it's attacker-controlled data with no legitimate use once past validation, and it's an easy vector into logs, prompts, or UI rendering later. Drop it.
- **Per-IP rate limiting alone doesn't protect the shared free-tier budget.** The existing video AI routes are naturally throttled by needing a real yt-dlp download first; this route's only cost is a text completion, making it cheap to hit from many different IPs. A small botnet distributed across IPs could exhaust the shared Groq/Gemini free-tier quota and take the feature down for every legitimate user. Add a **global daily token/request budget** in the rate-limit store (not just per-IP), and evaluate adding a lightweight bot-check (e.g., Turnstile) on this route specifically — neither exists in this app today.
- **Prompt injection → stored XSS is a real, specific path here, not a generic "sanitize input" note.** A PDF can contain invisible text (white-on-white, or positioned off-page) that pdf.js's text extraction still reads. That text is sent verbatim as part of "the document" to the LLM. If the AI's response is ever rendered as markdown/HTML rather than plain text, a crafted PDF becomes a prompt-injection vector aimed at producing an XSS payload in the response — and because this app registers a service worker, a successful compromise could persist beyond a single page load. **Render summaries as plain text.** Explicitly delimit the extracted document text as untrusted data in the prompt structure, not concatenated freely with instructions.
- Never log the extracted text content, matching this app's existing "never leak internals" discipline.

### 5.3 Non-goals, stated honestly

- Server-side malware scanning of PDFs: not applicable — the file never reaches the server.
- True content-stream text rewriting: explicitly out of scope, see §0.
- Multi-language "Add text": out of scope for v1, see §3.1.

### 5.4 Caching

`sha256(text)` keying is sound and content-addressed (no cache-poisoning vector), but:
- **Version the cache key with the prompt/model identifiers** — otherwise a future prompt change can silently serve stale summaries generated under the old prompt.
- Use a **separate cache namespace from video summaries**, with its own (likely shorter) TTL, and disclose in `/privacy` that summarized document text may be cached server-side for a bounded period to avoid re-processing identical documents.

---

## 6. Testing & verification strategy — what "not even 2% error" actually requires

This is the section that turns "the spike proved it once, manually" into something a production launch can stand on. **A blocking prerequisite, stated plainly: this repo has no test runner today** — `package.json` has no `test` script, no Vitest, no Playwright wired up. Zero-error confidence is not achievable until the spike's checks become permanent, CI-enforced tests — a one-time manual spike is a demo, not verification, no matter how thorough.

### 6.0 Phase 0 — before any feature code: build the harness

1. **Wire up `vitest` (unit/integration) and `@playwright/test` (browser) as first-class project dependencies** — this is infrastructure the project doesn't have yet, and it's the actual prerequisite for everything below.
2. **Build a real, committed PDF test corpus** in `test/fixtures/pdf/`, each file with a `manifest.json` recording its producer, page count, and expected extracted text. Minimum set: Word export, Google Docs export, LibreOffice export, InDesign/Acrobat Distiller output, LaTeX output, a flatbed scan (~300 DPI), a phone-camera scan (skewed, shadowed, under 150 DPI), an AcroForm with filled and unfilled fields, a password-protected PDF (both user- and owner-password variants), a truncated/corrupted file, a zero-byte file, a 1-page file, a 500-page file, non-Latin script samples (Arabic RTL, CJK, Devanagari, Cyrillic — to verify these are *detected and cleanly refused* per §3.1's scope limit, not mangled), pages at each rotation (90/180/270), mixed page sizes within one document, and both embedded-subset-font and system-font documents.
3. **A golden round-trip harness**: open with pdf.js → mutate with `@cantoo/pdf-lib` (add text/image, cover a region, merge, split) → re-open → assert page count, per-page rotation and MediaBox, text-layer equality where expected, and that forms/annotations either survive intact or fail with an explicit, tested error — never silently. Run across the entire corpus. This single artifact is the highest-value piece of test infrastructure in this plan.
4. **Security assertions as executable tests, not just a version pin in `package.json`:** a CI check that the installed `pdfjs-dist` version is outside the CVE range at build time; `npm audit` as a CI gate; a known-hostile-structure test PDF (embedded JS action, deep object recursion, oversized declared MediaBox) asserted to fail closed with a typed error and no worker hang; a Playwright-based assertion that **zero network requests fire while a file is loaded in the Editor** — the privacy claim, made machine-enforced rather than just documented.

### 6.1 OCR accuracy — the actual acceptance bar

One clean synthetic image at 95% confidence is not evidence of production readiness. Before any accuracy claim appears in landing-page copy: **at least 30 pages across five quality tiers** (300 DPI print scan, 200 DPI, 150 DPI, phone photo, table-heavy layout), scored by **character error rate against committed ground-truth text** — not Tesseract's self-reported confidence score, which measures a different thing than correctness. Proposed gates: CER ≤2% at 300 DPI, ≤8% at 150 DPI. Tables and handwriting stay explicitly out of scope in copy per §3.9's existing framing. Also assert **word bounding-box accuracy** (±3px) for the OCR-to-searchable-PDF path specifically — text-only scoring can pass while the invisible text layer is misaligned with the visible scan, which would make the "searchable" feature useless despite the text itself being correct.

### 6.2 Device matrix — non-negotiable before launch

**Real iOS Safari, on a real device, is a launch blocker — not a nice-to-have.** Every memory-crash risk flagged in §3.4 is specifically an iOS Safari behavior; nothing about it can be verified on desktop Chrome, no matter how much desktop testing is done. Minimum matrix: iOS Safari 17 and 18 on an aging device (iPhone 12/SE class, not the newest hardware), iPadOS, Android Chrome on a 4GB-RAM device, and desktop Chrome/Firefox/Safari/Edge. Per device: open a 500-page document, run a 20-page OCR sequence, load a file at the exact size guardrail, and background the tab mid-OCR. Record peak memory and whether the tab is actually killed — a crash needs to be caught by a pre-flight capability/size check shown to the user, never discovered by the user's tab silently dying.

### 6.3 Cover-and-replace edge cases

Explicit test cases, not just "it generally works": replacement text longer than the original (decide and test: clip, shrink-to-fit, or reflow); a needed glyph missing from the embedded font subset (fallback substitution must be visible in the live preview, not a surprise at export time); a cover box over a rotated page (coordinate transform correctness); a cover box over a page with a background image or color gradient (a plain white box will visibly reveal itself as an obvious patch); an undo/redo command stack with an explicit invariant test (N operations, N undos, byte-identical export to the untouched original); re-exporting the same document twice (idempotency); a page with 100+ overlay objects (performance floor, not just correctness).

### 6.4 Rollout strategy

Since client-side PDF bugs are inherently device/browser/PDF-producer-dependent in a way server bugs are not, a staged rollout catches problems a corpus can't fully anticipate: internal → 5% (real-device beta cohort) → 25% → 100%, each step gated on zero new crash reports. With no database in this app, instrument via **client-side, privacy-respecting error counts only** — crash/fallback rate bucketed by browser+OS+page-count, never filenames or document content — plus a visible "report a broken PDF" path that asks for the *producer application name*, never the file itself. Keep a fast rollback switch on each new landing page independently.

**What this doesn't solve, stated honestly:** real-world PDF diversity is effectively unbounded; the corpus and device matrix reduce risk, they do not eliminate it. This is why the staged rollout in §6.4 exists as a second line of defense, not a formality.

---

## 7. SEO — corrected strategy

### 7.1 A pre-existing, unrelated bug worth fixing regardless of this feature

`src/lib/schema.ts` currently hardcodes a **fabricated `aggregateRating`** (4.8 stars / 1,240 reviews) into `webApplicationSchema()`, emitted on every page site-wide. This is fake review data under Google's structured-data spam policy and risks a sitewide manual action — not scoped to PDF tools, but surfaced during this review and worth fixing on its own, independent of whether the PDF tools ship.

### 7.2 Keyword targeting — corrected: v1 aimed too high

`pdf editor online free` / `merge pdf free` sit in DR-90 incumbent territory (Smallpdf, iLovePDF, Sejda, Adobe) that a new site section will not rank for in year one. Keep those as canonical hub pages (they earn internal link equity and entity relevance) but place actual ranking expectations on **long-tail terms this site can uniquely and honestly satisfy**: *pdf summarizer without uploading*, *summarize pdf ai free no signup*, *ocr pdf offline browser*, *edit pdf without uploading to server*, *merge pdf offline in browser*, *remove metadata from pdf online*. Lower volume, near-zero competition, and the claim is verifiably true here in a way it usually isn't for competitors who upload the file to their own servers.

- **One URL per engine, not two.** v1 listed both `/pdf-to-searchable-pdf` and `/ocr-pdf` as separate pages for the same underlying feature — that's cannibalization. Pick `/ocr-pdf` as canonical; fold the "searchable PDF" intent into an H2 + FAQ section on that one page.
- `/pdf-editor`, `/merge-pdf`, `/split-pdf` sharing one component "in reduced mode" (as v1 proposed) risks **duplicate content** under this project's own stated content standard (CLAUDE.md explicitly treats templated/duplicate copy as a ranking killer). Each page needs genuinely distinct copy, FAQ, and steps — budget this as real content-writing work, not a registry flag.

### 7.3 Lean on the privacy differentiator — it's the only one that's both durable and independently verifiable

Every major incumbent uploads the user's file to their servers; this tool genuinely doesn't. Make the claim falsifiable on-page, not just asserted: *"Works with Wi-Fi off. Open DevTools → Network — you'll see zero requests while editing."* Pair with the metadata-stripping default (§5.1). In schema: `isAccessibleForFree: true`, a real `featureList`, and correct `applicationCategory: "UtilitiesApplication"` — not `MultimediaApplication`, which is what similar tools elsewhere in this app currently use and is the wrong category for a PDF tool. Note: Google retired rich-result treatment for `HowTo` in 2023 and restricts `FAQPage` display broadly — keep both for entity/intent clarity, not in expectation of SERP rich snippets.

### 7.4 Missing from v1 entirely

- **A comparison/alternative content cluster** — *smallpdf alternative*, *ilovepdf alternative free*, *adobe acrobat free alternative* — each converting specifically on the privacy angle.
- **Correction to v1's assumption about existing blog equity:** the site's 65 existing blog posts are all video-platform topics, and `BlogCategory` in `lib/blog.ts` is typed as `PlatformKey` — a PDF content category doesn't exist today and can't without a type change. Don't count on link equity transferring from unrelated video content; plan 6–8 *new* PDF-specific posts instead.
- **Sitemap correction:** v1 stated sitemap inclusion is automatic once a registry exists. Checked directly — `src/app/sitemap.ts` enumerates each registry via an explicit named import per section. A `PDF_TOOL_LIST` needs its own explicit block added; it is not automatic.
- **Multilingual scope correction:** v1 raised this as an open question. Checked directly — this site has no i18n routing (`site.ts` sets a single `en_US` locale; `seo.ts` sets only a canonical URL, no `hreflang`/`languages` alternates). English-only is the honest, correct v1 scope, not a gap to close. Tesseract's multi-language trained-data support is an OCR *feature* to mention on `/ocr-pdf`, unrelated to site localization.

---

## 8. Build order — resequenced

v1 shipped the Summarizer first on the reasoning that it was the smallest surface. Solution-architect review recommends a different first slice that gets pages indexed earlier and avoids the two heaviest sources of risk (OCR's resource profile, the AI privacy-disclosure requirement) in the very first release:

1. **Editor — page operations only**: merge, split, rotate, reorder, delete pages via `@cantoo/pdf-lib`, no rendering-heavy viewer, no AI, no OCR. Matches the highest-search-volume, lowest-competition-realistic keywords (§7.2) and is the simplest possible slice to get right, tested, and shipped. Also fully proves the `@cantoo/pdf-lib` export/round-trip pipeline (§6.0.3) before anything more complex depends on it.
2. **PDF Summarizer — text-layer documents only.** Ship without OCR fallback initially: a scanned PDF with no extractable text layer gets a clean "this looks like a scanned document — try our OCR tool" redirect rather than silently invoking Tesseract. This defers the OCR resource/timing complexity (§3.3–3.4) out of the AI feature entirely, while still shipping real summarization value for the (large) share of PDFs that already have a text layer. Ship with the Gemini-first provider change (§2.1) and the full route hardening (§5.2) from day one — these are not deferrable.
3. **Editor — add content**: text boxes, images, table grids as new overlay objects. The genuinely "real," no-caveat editing capability.
4. **Editor — OCR**: per-page OCR-to-text (this is also what unlocks OCR fallback for the Summarizer, retrofitted once proven) and OCR-to-searchable-PDF. Ship only after §6.1's accuracy bar and §6.2's real-device matrix are both green — this phase has the most unverified risk in the whole plan (corrected-but-still-unconfirmed timing, iOS memory behavior) and should not ship on schedule pressure alone.
5. **Editor — cover-and-replace "editing" of existing content**: the riskiest, most fiddly UI, and the one with a genuine misuse risk if the §0 warning isn't correctly built in from the first line of UI code. Shipped last, once the foundation from steps 1–4 is proven solid in production.

Each phase is independently shippable — nothing here requires a later phase to exist before an earlier one goes live. Phase 4 (OCR) is the one phase explicitly gated on verification evidence rather than just "the code works," given how much of this plan's own numbers had to be corrected by expert review before they were trustworthy.
