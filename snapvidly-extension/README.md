# SnapVidly Browser Extension (Manifest V3)

A **deep-link-only** extension: on a supported **video page** it shows a floating
"⬇ SnapVidly" button (and a toolbar icon) that opens
`https://snapvidly.com/?grab=<page-url>`, where the site extracts the video and
offers downloads. **No downloading, no API calls, no tracking** — just `activeTab`.

This design is intentional:
- **Store-safe** — extensions that download media themselves are often rejected; a shortcut isn't.
- **Low-maintenance** — the site handles platform changes, not the extension.
- **Fast** — one click → the site auto-extracts (`?grab=` handler).

## How it works
1. `content.js` checks the current URL against a per-platform **video-URL pattern** (only shows the button on a real video page, not feeds/home) and re-checks on SPA navigation.
2. Click the button (or the toolbar icon) → opens `snapvidly.com/?grab=<url>` in a new tab.
3. The site validates the link, auto-extracts, and shows quality/download options.

## Files
- `manifest.json` — MV3, `activeTab` only, Chrome + Firefox (via `browser_specific_settings.gecko`).
- `content.js` — video-page detection + button (SPA-aware).
- `background.js` — toolbar-icon click → open `?grab=` for the active tab.
- `content.css` — floating button style.
- `icons/` — 16/32/48/128 PNGs (SnapVidly play mark).

## Load & test locally
- **Chrome / Edge:** `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.
- **Firefox:** `about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick `manifest.json`.

Open a video (e.g. a YouTube watch page) → the button appears bottom-right → click it → SnapVidly opens with the video ready.

## Package for the stores
```bash
cd snapvidly-extension
zip -r ../snapvidly-extension.zip . -x "README.md"
```

## Publish
- **Firefox (AMO)** — https://addons.mozilla.org/developers/ → submit the zip. AMO is the more permissive store; **publish here first**.
- **Chrome Web Store** — https://chrome.google.com/webstore/devconsole (one-time $5 fee) → upload the zip. **Note:** Google's policy may reject media-download helpers; if so, the on-site **bookmarklet** and **PWA "Share to SnapVidly"** cover Chrome users with no review.

After publishing, update the store links on `snapvidly.com/browser-extension`.

## Config
The target site is hard-coded to `https://snapvidly.com` in `content.js` and `background.js` — change both if your domain differs.
