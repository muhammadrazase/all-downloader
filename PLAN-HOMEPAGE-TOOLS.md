# Plan — Homepage "Toolkit" Section (UI/UX + SEO)

> **Goal:** surface the full tool ecosystem (AI tools, converters, thumbnail grabbers, utilities) on the homepage instead of hiding it in the nav dropdown — maximizing discoverability, internal-link SEO, and keyword coverage, without hurting the premium landing feel or Core Web Vitals.
> **Deliverable of this doc:** the design, the agent/skill plan, and the SEO/keyword strategy. No code yet.

---

## 1. UX decision — on-page section, NOT a sidebar
| Option | Verdict |
|---|---|
| Persistent sidebar | ❌ Dashboard feel on a landing page, eats width, hurts LCP/CLS, off-pattern for tool sites. |
| **On-page categorized "toolkit" section** | ✅ Discoverable, scannable, mobile-first, every card an internal link, hero stays clean. |
| Hero quick-link chips | ⚠️ Secondary touch for the AI differentiators only. |

**Placement:** `/` → after the existing platform grid, before "How it works." Hero + paste box stay the primary action; the toolkit is the natural next scroll.

---

## 2. Expert agents & skills to use
| Agent | Role in this task |
|---|---|
| `uiux-designer` | Section layout, card system, states, motion, responsive, a11y — premium, not vibe-coded. |
| `seo-strategist` | Keyword map (below), anchor-text, heading hierarchy, `ItemList` structured data, internal-link strategy. |
| `content-writer` | The one-line tool blurbs + keyword-aware anchor text/microcopy. |
| `performance-engineer` | Confirm zero CWV/LCP/CLS cost (server-rendered, no JS/images). |
| `security-auditor` | Not required — no input/engine/secret surface (static links only). |

**Skills:** `ui-ux-pro-max` + `design-system` + `ui-styling` (grounded tokens/components), `seo-strategist` reference in `SEO-STRATEGY.md`.

---

## 3. UI/UX design (expert, on the existing design system)
**Section header:** H2 "More than a downloader" + one-line subhead. Generous whitespace, centered, on the 8px grid.

**Four labeled category groups**, each = an H3 label (with a small accent icon + optional "New" badge) over a responsive card grid:
1. **AI tools** (lead, "New" badge) — Video to Text, Video Summary.
2. **Converters** — Video→MP3, Video→GIF, All-in-one converter.
3. **Thumbnail grabbers** — YouTube Thumbnail, TikTok Thumbnail.
4. **Utilities** — Bulk Downloader, Chrome Extension.
*(11 platform downloaders already have their own grid above — no duplication.)*

**Card anatomy** — reuse `PlatformGrid` treatment exactly (`card`, `hover:-translate-y-0.5`, `hover:border-accent/30`, `hover:shadow-md`): accent-tinted icon tile + tool name + one-line benefit. Grid `grid-cols-2 → sm:3 → lg:4`.

**Design guardrails (anti-vibe-coded):**
- **One accent color only** — categories differ by *label + icon*, never by color (no rainbow).
- Existing tokens only (accent-soft, ink ramp, radius/shadow ladder). No arbitrary values.
- Motion: 150–250ms transform/opacity, reduced-motion safe. No bounce/neon/gradient.
- A11y: semantic `<section aria-labelledby>`, real H2/H3, focus-visible, AA contrast, 44px targets.

---

## 4. SEO strategy (the emphasis) 🎯

### 4.1 Why this section is an SEO win
- Adds **~9 keyword-rich internal links from the homepage** (the site's highest-authority page) to tool pages → passes link equity, speeds indexing, and builds topical authority for the "video tools" cluster.
- Creates a **descriptive on-page text block** (headings + blurbs) that reinforces each tool page's target terms via relevant anchor text and surrounding copy.
- **`ItemList` structured data** helps Google understand the toolkit → eligibility for sitelinks / richer SERP presentation.

### 4.2 On-page rules
- **Anchor text = the tool's primary keyword**, not "click here" (e.g. link text "Video to Text", blurb "Transcript + SRT/VTT subtitles").
- Heading hierarchy: one H1 (hero) → H2 (section) → H3 (group labels). No skipped levels.
- Section subhead includes cluster keywords ("transcribe, summarize, convert, thumbnails").
- Keep it text + inline-SVG (no images) so it's crawlable and weightless.

### 4.3 Structured data
- `ItemList` of all tools (name + description + url) rendered as JSON-LD in the section.
- Existing per-page `WebApplication` / `HowTo` / `FAQPage` schema stays as-is.

### 4.4 Keyword map — better-ranking targets per tool
Chosen for **high intent + achievable difficulty** (long-tail first, per `SEO-STRATEGY.md`). Use the **primary** as the tool page's H1/title anchor and the **long-tail** across blurbs/FAQs/blog.

| Tool | Primary (target) | Secondary | Long-tail (fastest wins) |
|---|---|---|---|
| **Video to Text** | video to text | transcribe video, video transcript generator | download youtube transcript free · get subtitles from a video · video to srt online · auto generate subtitles free · convert speech to text from video |
| **Video Summary** | video summary | summarize video with ai, ai video summarizer | summarize youtube video free · get key points from a video · tiktok video summary ai · summarize a video without watching |
| **Video to MP3** | video to mp3 | youtube to mp3, convert video to mp3 | video to mp3 converter online free · extract audio from video · youtube to mp3 320kbps · tiktok to mp3 |
| **Video to GIF** | video to gif | convert video to gif | video to gif maker online free · turn a clip into a gif · youtube to gif · mp4 to gif no watermark |
| **Video Converter** | video converter | online video converter | free video converter no upload · convert mp4 online · browser video converter no watermark |
| **YouTube Thumbnail** | youtube thumbnail downloader | download youtube thumbnail | youtube thumbnail grabber hd · get youtube thumbnail image · download youtube thumbnail 4k · save youtube video cover |
| **TikTok Thumbnail** | tiktok thumbnail downloader | download tiktok thumbnail | save tiktok cover image · get tiktok video thumbnail · tiktok thumbnail grabber |
| **Bulk Downloader** | bulk video downloader | batch video downloader | download multiple videos at once · batch download tiktok/youtube · mass video downloader free |
| **Chrome Extension** | video downloader chrome extension | one click video download chrome | download video from any site chrome · chrome extension to save videos · one-click video downloader |

**Section-level keywords to weave into headings/subhead:** `free online video tools`, `all-in-one video toolkit`, `video downloader and converter`, `ai video tools free`.

### 4.5 Supporting off-page (already in `SEO-STRATEGY.md`)
- Interlink new AI tool pages ↔ related blog posts (e.g. "how to get subtitles from a video") — each tool page should link to a how-to and vice-versa.
- Add the two AI tools to Product Hunt / AlternativeTo / "There's an AI For That" (the AI-angle directories) for topical + backlink lift.
- Add 3–5 long-tail blog posts targeting the "video to text / summarize video" cluster (new keywords no basic downloader ranks for).

---

## 5. Performance & accessibility
- **Zero CWV cost:** server-rendered static HTML, no client JS, inline SVG icons, no images → no LCP/CLS/INP impact. Fits the ≥95 Lighthouse / LCP<1.5s budget.
- Fully keyboard-navigable, screen-reader-friendly headings, AA contrast.

---

## 6. Implementation shape (when approved)
- **New `src/components/ToolsSection.tsx`** — server component, **registry-driven** (`AI_TOOL_LIST`, `CONVERTER_LIST`, `IMAGE_TOOL_LIST` + 2 static utilities) so it auto-grows when a tool is added. One small `BLURB` map for microcopy.
- **`src/lib/schema.ts`** — add `itemListSchema()` helper.
- **`src/app/page.tsx`** — render `<ToolsSection />` after the platform grid (~2 lines).
- No API/engine/registry changes, no new deps.

## 7. Rollout & verification
1. `uiux-designer` builds the section; `seo-strategist` reviews anchor text + schema; `performance-engineer` confirms CWV.
2. `next build` + `tsc` + `lint` clean; both AI tool + converter links resolve.
3. Verify: homepage shows all groups, `ItemList` JSON-LD validates (Rich Results Test), Lighthouse SEO ≈ 100, no CLS.
4. Submit updated `/` to Search Console; watch impressions on the new keyword cluster.

## 8. Optional secondary polish
- **Navbar mega-menu:** add small icons + one-line descriptions to the "Tools" dropdown (less "hidden").
- **Hero chip row:** slim quick-links under the paste box for the AI differentiators (Video to Text · Video Summary · MP3).
- **Footer:** already links everything — no change.
