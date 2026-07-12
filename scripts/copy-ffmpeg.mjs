#!/usr/bin/env node
/**
 * Copies the ffmpeg.wasm single-thread core into /public/ffmpeg so the converter
 * can self-host it (no external CDN). Runs on postinstall; non-fatal if the core
 * package isn't present (e.g. production installs that omit devDependencies).
 */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const dest = path.join(root, 'public', 'ffmpeg');

try {
  if (!existsSync(path.join(src, 'ffmpeg-core.wasm'))) {
    console.warn('[copy-ffmpeg] @ffmpeg/core not found — skipping (converter needs it; run `npm i -D @ffmpeg/core`).');
    process.exit(0);
  }
  mkdirSync(dest, { recursive: true });
  for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) copyFileSync(path.join(src, f), path.join(dest, f));
  console.log('[copy-ffmpeg] core copied to public/ffmpeg');
} catch (e) {
  console.warn('[copy-ffmpeg] skipped:', e?.message);
  process.exit(0);
}
