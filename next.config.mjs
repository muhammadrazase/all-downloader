/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Lets e2e spin up its own `next dev` (playwright.config.ts) without sharing
  // .next with a dev/prod server already running against this same checkout —
  // two processes writing the same build cache concurrently corrupts it for both.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // better-sqlite3 ships a native binding — keep it a real require(), never bundled.
  serverExternalPackages: ['better-sqlite3'],
  // permanent:true → a real 308, preserving /tools' SEO equity now that the
  // full tool directory lives on the homepage instead of a separate page.
  async redirects() {
    return [{ source: '/tools', destination: '/', permanent: true }];
  },
  experimental: {
    serverActions: {
      // Admin panel mutations are Server Actions behind a reverse proxy — without
      // this, Next's same-origin check on the Origin header rejects them.
      allowedOrigins: [new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://snapvidly.com').host],
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Only known platform thumbnail CDNs — prevents the image optimizer from
    // being abused as an open proxy to fetch arbitrary/internal URLs.
    remotePatterns: [
      { protocol: 'https', hostname: '**.ytimg.com' },
      { protocol: 'https', hostname: '**.ggpht.com' },
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.tiktokcdn-us.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.licdn.com' },
    ],
  },
  async headers() {
    // Traced against every actual script/style/worker/media source in this
    // codebase — not a generic template. Kept in next.config.mjs (not
    // middleware) since middleware never runs for a force-static page's
    // cached HTML; a header set here is the only way to cover every route.
    //
    //  - 'wasm-unsafe-eval' in script-src: ffmpeg.wasm, tesseract.js and
    //    pdf.js all compile WebAssembly client-side.
    //  - worker-src needs 'blob:': heic-to inlines its worker as a blob URL
    //    (see the Performance Budget section below); tesseract's own worker
    //    is a same-origin file, covered by 'self'.
    //  - media-src needs 'blob:': every trim/compress/watermark/merge/frame
    //    tool previews an uploaded file via <video>/<audio src="blob:...">.
    //  - img-src allows any https: origin, not a platform allowlist — result
    //    thumbnails render as unoptimized <img> pointing straight at whichever
    //    CDN host the source platform used (see DownloaderBox's ResultCard),
    //    which varies too much across 11 platforms to enumerate; img-src
    //    can't execute script, so this is a low-risk, deliberate loosening.
    //  - style-src allows 'unsafe-inline': React's style={{...}} props (brand
    //    colors, computed ad-slot dimensions) render as inline style
    //    attributes throughout the app; a strict style-src would need a nonce
    //    on every one of them, which static generation can't provide. CSS
    //    injection is a materially smaller risk than script injection, which
    //    script-src is not relaxed for.
    //  - script-src allows Plausible/GA/Ezoic/Media.net specifically because
    //    Analytics.tsx and AdScripts.tsx only ever load those exact hosts.
    //    KNOWN GAP: GA's inline `gtag('config', ...)` snippet has no nonce
    //    (would need per-request middleware, which force-static pages skip)
    //    and IS blocked by this policy — gtag.js itself still loads, but the
    //    config call silently no-ops. Plausible (this site's preferred
    //    option, see Analytics.tsx) needs no inline script and is unaffected.
    //    The "paste your own script src" ad networks (Adsterra popunder/
    //    social-bar, Monetag, PropellerAds, HilltopAds, Galaksion — see
    //    ads.ts) accept an arbitrary admin-configured URL with no fixed host,
    //    so they cannot be pre-allowlisted: enabling one of those for the
    //    first time means adding its script host to script-src here too.
    //  - script-src needs 'unsafe-inline' in EVERY environment, not just dev.
    //    Next's own App Router injects `self.__next_f.push(...)` inline
    //    scripts on every page to stream RSC payloads for hydration — verified
    //    directly against a real `next build && next start` (59 of them on
    //    the homepage alone), not just `next dev`. Removing 'unsafe-inline'
    //    would break hydration on every page, not just ones this app wrote.
    //    Next's own fix for this is a per-request nonce stamped onto those
    //    scripts by middleware — which requires middleware to run on every
    //    request, directly conflicting with this site's static-first
    //    architecture (`middleware.ts` deliberately skips force-static pages;
    //    forcing it to run everywhere would mean losing the Full Route Cache
    //    site-wide to get a stricter script-src). Given that trade, this
    //    header does NOT stop an attacker who achieves script injection (a
    //    future stored-XSS bug, say) from executing — that protection has to
    //    come from correct output-escaping instead (see serializeJsonLd).
    //    What it DOES still stop even with 'unsafe-inline': exfiltrating
    //    stolen data to an attacker's own server (connect-src has no inline
    //    exception — an injected script can't fetch() an arbitrary origin),
    //    clickjacking (frame-ancestors), a hijacked <base>/<form> tag, and
    //    legacy <object>/<embed> exploits. Real defense-in-depth, just not a
    //    script-injection backstop.
    //  - 'unsafe-eval' is added ONLY outside production: `next dev` uses
    //    eval-based source maps (verified: a real prod build never emits a
    //    script-src 'eval' violation, only 'inline' ones) — allowing it in
    //    dev keeps `npm run dev` working without weakening what ships.
    const devOnly = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://plausible.io https://www.googletagmanager.com https://www.ezojs.com https://contextual.media.net${devOnly}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "connect-src 'self' https://plausible.io https://*.google-analytics.com https://www.googletagmanager.com",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy', value: csp },
    ];
    return [
      // Negative-lookahead, not a second '/:path*' — keeps exactly one Permissions-Policy per response.
      {
        source: '/qr-code-scanner',
        headers: [...baseHeaders, { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' }],
      },
      {
        // '/?' matters: a bare '$' here let '/qr-code-scanner/' match both this rule and the one above.
        source: '/((?!qr-code-scanner/?$).*)',
        headers: [...baseHeaders, { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }],
      },
    ];
  },
};

export default nextConfig;
