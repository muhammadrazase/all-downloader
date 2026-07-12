# REVENUE-STRATEGY.md — SnapVidly

The monetization playbook. Pairs with **ADS-SETUP.md** (display/pop-under setup)
and **ADS-POLICY.md** (compliance). This doc is the *strategy* those two serve.

> **Thesis:** display ads are the **worst-fit** revenue model for a downloader
> audience, yet they're the easiest to reach for. This audience runs ad blockers
> at 30–50%+, skews to low-CPM geos, and is **locked out of Google/AdSense-grade
> demand by copyright policy**. So we treat display as a *floor*, and build a
> diversified stack where affiliate, the extension, Pro, and the API do the real
> earning.

---

## The revenue stack (build in this order)

| # | Lane | Yield here | Durable? | Status in repo |
|---|---|---|---|---|
| 1 | **Freemium "Pro" tier** | ★★★★★ | ★★★★★ | Not built — biggest future lever |
| 2 | **Contextual affiliate** | ★★★★☆ | ★★★★★ | ✅ **Built** (`offers.ts` + `RelatedOffers`) |
| 3 | **Browser extension (as product)** | ★★★★☆ | ★★★★★ | Built; now promoted via house ads |
| 4 | **Extraction API (B2B / RapidAPI)** | ★★★☆☆ | ★★★★☆ | Engine ready (`engine.ts`); not productized |
| 5 | **Display + pop-under (fill floor)** | ★★☆☆☆ | ★☆☆☆☆ | ✅ Built; now backfilled with house ads |

---

## ⚠️ The AdSense/Ezoic reality (do not skip)

Google Publisher Policies prohibit monetizing content that "facilitates
unauthorized access to or download of copyrighted material." **YouTube/social
downloaders get AdSense rejected or banned.** Ezoic runs primarily on Google AdX
demand, so it carries the **same** risk — the "graduate to Ezoic at 10k visits"
path in older docs is largely a dead end for this niche. Media.net (Yahoo/Bing
demand) is similar.

**Consequence:** your realistic display lane is the aggressive one (Adsterra/
Monetag). Don't build the business on premium display. If you want higher display
CPMs later with real traffic, evaluate tool-site-friendly networks (Snigel,
Playwire, Newor) — not AdSense/Ezoic.

---

## Lane 1 — Freemium Pro tier (the scale engine)

How the big downloaders actually earn. Architecture is already primed
(rate limiting, concurrency caps, quality tiers, batch box).

- **Free:** browser-based, rate-limited, ads on, standard quality, single downloads.
- **Pro (~$3–5/mo or $29/yr):** no ads, **batch/bulk**, **4K/8K + HD merges**,
  priority queue (raise their `MAX_CONCURRENT`), 320 kbps MP3, API access.
- **Billing:** use a **merchant-of-record** (LemonSqueezy / Paddle) — they handle
  global VAT/tax across your geo spread. Avoid raw Stripe here; cross-border tax will bury you.
- **Why it wins:** monetizes Tier-3 traffic display can't, and is ad-block-immune.
  Even 0.3–0.5% conversion at $4/mo beats total ad revenue at scale.

## Lane 2 — Contextual affiliate ✅ built

High intent: people who save video also **edit, store, stream safely, and record**.
Rendered natively (`RelatedOffers`) with `rel="sponsored"` so it survives ad
blockers and stays inside Google's paid-link policy. See "Turn it on" below.

## Lane 3 — The extension is the moat

Installs survive ad-block, SEO shifts, and platform changes. Treat it as a
**product**: funnel from every page (house ads now do this automatically when no
paid ad fills), monetize with the same affiliate + Pro upsell, grow the Chrome
Web Store listing as distribution you own.

## Lane 4 — Sell the engine (B2B)

The extraction engine is already abstracted behind `/api/extract`. List it on
**RapidAPI** as a social-download API ($10–200/mo per developer). Near-zero
marginal effort; diversifies fully off consumer ad revenue; RapidAPI bills for you.

## Lane 5 — Display/pop-under (floor only)

Keep Adsterra/Monetag as a floor. Two leaks now fixed in code:
1. **House-ad backfill** — unsold slots render a first-party extension promo (or a
   configured affiliate offer) instead of blank space. See `HouseAd.tsx`.
2. **No premium fantasy** — treat Ezoic/Media.net as unavailable for this niche.

---

## Turn on affiliate offers (Lane 2)

Offers live in `src/lib/offers.ts`. Each is **off until its URL env var is set**,
so nothing shows until you have the partnership. Add these to `.env` (all are
`NEXT_PUBLIC_*` — public by nature, inlined at build), then rebuild
(`sudo bash up.sh`):

```
# Contextual affiliate offers — paste your affiliate/tracking URL per partner.
# Empty = that offer stays hidden. Rebuild after editing.
NEXT_PUBLIC_AFFILIATE_VPN_URL=          # VPN (NordVPN/Surfshark/ExpressVPN) — downloader + blog pages
NEXT_PUBLIC_AFFILIATE_EDITOR_URL=       # Video editor (CapCut/Filmora/Descript) — downloader/converter/blog
NEXT_PUBLIC_AFFILIATE_STORAGE_URL=      # Cloud storage (pCloud/Icedrive) — downloader/converter
NEXT_PUBLIC_AFFILIATE_AI_URL=           # AI writer — AI-tool + blog pages
NEXT_PUBLIC_AFFILIATE_RECORDER_URL=     # Screen recorder — downloader/thumbnail pages
```

Add more offers by appending rows to the `CATALOG` in `offers.ts` (id, copy,
`envKey`, `contexts`, optional `platforms`). Keep taglines honest — deceptive
affiliate copy tanks trust and conversion.

**Where they render:** platform pages (`/[tool]`), converters, and AI tools show a
`RelatedOffers` strip; VPN/editor offers surface first on their tagged platforms.
Add `<RelatedOffers context="…" />` to any other page you want monetized.

---

## Phased roadmap

- **Phase 0 (→10k/mo):** Adsterra floor + house-ad backfill (done); configure 2–3
  affiliate offers; push extension installs; **start email capture** (re-monetization asset).
- **Phase 1 (10k→100k/mo):** affiliate becomes primary (optimize per page by EPC);
  **launch Pro**; **list the API on RapidAPI**; add programmatic SEO (platform × device × use-case).
- **Phase 2 (100k→1M/mo):** scale Pro (annual plans, churn work); B2B API tiers;
  direct ad deals; consider white-label / multi-domain.

## Instrument this (currently blind)

Track **EPMV per page-type**, **affiliate EPC per offer**, **extension install +
retention**, **Pro conversion / churn / LTV**, and **revenue by geo tier**. You
can't optimize what you don't measure; segment monetization (display for Tier 1,
affiliate/Pro for Tier 3).

## Revenue risks that are business risks

- **yt-dlp breakage = revenue outage** across every lane — engine reliability *is* uptime.
- **Single-provider concentration** — never let one network/geo/platform exceed ~40% of revenue.
