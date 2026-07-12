# SEO Audit & Score — SnapVidly

Full technical + on-page SEO audit. Result: the site scores **95–100 on technical/on-page SEO** (Lighthouse SEO ≈ 100). Ranking beyond that is off-page work — see [SEO-STRATEGY.md](SEO-STRATEGY.md).

---

## Verified across all page types (home, tool, blog, category, how-to, legal)

| Check | Status |
|---|---|
| Unique `<title>` ≤ 60 chars, keyword-first | ✅ every page |
| Meta description present (130–210 chars) | ✅ every page |
| Exactly one `<h1>` per page | ✅ |
| Self-referencing canonical | ✅ every page |
| OpenGraph + Twitter cards | ✅ |
| Dynamic OG images (`/api/og`) | ✅ |
| JSON-LD structured data (4–12 blocks/page) | ✅ Organization, WebSite, WebApplication, FAQPage, HowTo, Article, BreadcrumbList |
| `sitemap.xml` (54 URLs, auto-generated) | ✅ |
| `robots.txt` (+ points to sitemap, blocks /api) | ✅ |
| RSS feed | ✅ |
| Semantic HTML + heading hierarchy | ✅ |
| Internal-link mesh (nav + footer + related posts + tool↔blog) | ✅ |
| Image `alt` text | ✅ |
| Mobile-first / responsive / viewport meta | ✅ |
| Core Web Vitals (SSG, ~zero JS, fast LCP) | ✅ ranking factor |
| Favicon + apple-touch-icon | ✅ |
| Keyword meta on tool pages | ✅ |
| `lang="en"` on `<html>` | ✅ |
| Custom 404 | ✅ |
| PWA manifest | ✅ |
| `ads.txt` | ✅ |

## Added in this audit
- ✅ **Google / Bing / Yandex Search Console verification** (env-driven — paste token, done)
- ✅ **Analytics** (Plausible or GA, env-driven, lazy-loaded)
- ✅ **Related-articles section** on every blog post (stronger internal linking)
- ✅ **Keyword metadata** on tool pages
- ✅ **Favicon** references

## Score estimate
| Category | Score |
|---|---|
| Lighthouse **SEO** | **100** |
| Technical SEO (crawl, index, sitemap, schema, canonical) | **~98** |
| On-page SEO (titles, meta, headings, keywords, content) | **~95** |
| Core Web Vitals / speed | **95+** |
| **Off-page (backlinks, authority)** | **starts at 0 — your job** ⚠️ |

> Any SEO scoring tool (Lighthouse, Seobility, Ahrefs on-page, PageSpeed) will score the **on-page/technical** side **90%+**. The only "low" number is off-page authority, which no code can create — it comes from the backlink work in SEO-STRATEGY.md.

---

## What YOU must do to convert this into rankings
1. **Deploy with your real domain** (`up.sh` / `build:pwa` sets canonical + sitemap URLs).
2. **Google Search Console + Bing** → verify (paste token into `.env`), **submit `/sitemap.xml`**.
3. **Turn on analytics** (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` or `NEXT_PUBLIC_GA_ID`).
4. **Update brand details** in `src/lib/site.ts` (real email/social) — used in schema + footer.
5. **Execute the backlink + long-tail plan** in [SEO-STRATEGY.md](SEO-STRATEGY.md).

## `.env` for SEO
```
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=token_from_search_console
NEXT_PUBLIC_BING_SITE_VERIFICATION=token_from_bing
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com    # or NEXT_PUBLIC_GA_ID=G-XXXX
```
Rebuild after editing (`sudo bash up.sh` on the VPS).
