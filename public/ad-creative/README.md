# ad-creative/

Home for **self-served ad creative** — static assets used by house ads, direct
ad deals, and sponsorship placements. Anything here is served from
`https://yourdomain.com/ad-creative/<file>`.

Most house ads are rendered as **components** (see `src/components/ads/HouseAd.tsx`
and `src/components/RelatedOffers.tsx`) because HTML creative is responsive,
theme-aware, and weightless — prefer that over images. Use this folder only when
a placement genuinely needs a raster/vector asset:

- **Direct/sponsorship banners** you sold yourself (a partner's 300×250 / 728×90 image).
- **House campaign art** (extension launch, Pro tier promo) if you want an image, not a component.
- **Affiliate creatives** a partner supplies as fixed-size images.

## Rules

- **Sizes:** match the slot — `rectangle` = 300×250, `leaderboard` = 728×90 (see `AD_SIZE` in `src/lib/ads.ts`). Wrong sizes cause layout shift (CLS) and fail the performance budget.
- **Weight:** compress hard. A banner over ~40 KB hurts LCP. Prefer WebP/AVIF or SVG.
- **Naming:** `<campaign>-<width>x<height>.<ext>` — e.g. `pro-launch-300x250.webp`.
- **No tracking pixels / third-party scripts** in anything you host here — that reintroduces the consent + privacy surface the native house ads deliberately avoid.
- **Label honestly:** first-party promos need no "Advertisement" label; paid/sponsored creative does.

## Wiring a hosted creative into a slot

`HouseAd` currently renders component creative. To serve an image from here
instead, point an `<img src="/ad-creative/…">` (with explicit `width`/`height`
to stay CLS-safe) from a house-ad variant, or link it from a direct-deal slot.
Keep the same reserved footprint as the paid banner it replaces.
