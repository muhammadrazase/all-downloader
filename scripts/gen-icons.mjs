/**
 * Rasterize the brand SVGs into the PNG icons a PWA needs for reliable install
 * on Android (home-screen icon + splash) — SVG-in-manifest is not honored by many
 * launchers. Runs at build/deploy; idempotent. Uses sharp (already a Next dep).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// sharp ships with Next but is optional; if it's absent, keep the committed PNGs.
let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.log('gen-icons: sharp unavailable — keeping existing PNG icons.');
  process.exit(0);
}

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const targets = [
  { svg: 'icon.svg', out: 'icon-192.png', size: 192 },
  { svg: 'icon.svg', out: 'icon-512.png', size: 512 },
  { svg: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
];

for (const { svg, out, size } of targets) {
  const buf = readFileSync(join(pub, svg));
  const png = await sharp(buf, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(join(pub, out), png);
  console.log(`✓ ${out} (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
