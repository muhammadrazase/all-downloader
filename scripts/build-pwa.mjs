#!/usr/bin/env node
/**
 * One-shot PWA build.
 *
 *   npm run build:pwa -- https://your-domain.com
 *   SITE_URL=https://your-domain.com npm run build:pwa
 *
 * It:
 *   1. Normalizes the base URL (adds https://, strips trailing slash/path).
 *   2. Generates a shareable QR code → public/qr.png, public/qr.svg, and prints
 *      it to the terminal for instant scanning.
 *   3. Runs `next build` with NEXT_PUBLIC_SITE_URL set, so every canonical tag,
 *      sitemap entry, manifest field and the on-site QR all point at that URL.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import QRCode from 'qrcode';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. Resolve + validate the base URL ─────────────────────────────
const raw = process.argv[2] || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
if (!raw) {
  console.error('\n✖ Missing base URL.\n');
  console.error('  Usage:  npm run build:pwa -- https://your-domain.com');
  console.error('     or:  SITE_URL=https://your-domain.com npm run build:pwa\n');
  process.exit(1);
}

let base;
try {
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  base = new URL(withProto).origin; // strips path, query and trailing slash
} catch {
  console.error(`\n✖ "${raw}" is not a valid URL.\n`);
  process.exit(1);
}

const qrOpts = { margin: 1, width: 512, color: { dark: '#0F172A', light: '#FFFFFF' } };

// ── 2. Generate the QR assets ──────────────────────────────────────
console.log(`\n▸ Base URL:  ${base}`);
console.log('▸ Generating QR code…');
mkdirSync(path.join(root, 'public'), { recursive: true });

const svg = await QRCode.toString(base, { ...qrOpts, type: 'svg' });
writeFileSync(path.join(root, 'public', 'qr.svg'), svg);
await QRCode.toFile(path.join(root, 'public', 'qr.png'), base, qrOpts);

console.log('  ✓ public/qr.png');
console.log('  ✓ public/qr.svg  (also served at /qr.svg and /qr.png)\n');

// Print a scannable QR right in the terminal.
console.log(await QRCode.toString(base, { type: 'terminal', small: true }));

// ── 3. Build with the URL injected ─────────────────────────────────
console.log(`▸ Building PWA for ${base} …\n`);
const res = spawnSync('npx', ['next', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: base },
});

if (res.status !== 0) {
  console.error('\n✖ Build failed.\n');
  process.exit(res.status ?? 1);
}

console.log(`\n✅ PWA built for ${base}`);
console.log('   • Shareable QR: public/qr.png  &  public/qr.svg');
console.log('   • Start it:     npm run start');
console.log('   • Install:      open the site on a phone and “Add to Home Screen”.\n');
