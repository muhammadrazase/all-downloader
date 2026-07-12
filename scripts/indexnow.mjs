#!/usr/bin/env node
/**
 * indexnow.mjs — instantly notify Bing & Yandex about all your pages so they
 * index in HOURS instead of waiting for a crawl.
 *
 *   npm run indexnow -- https://your-domain.com
 *   SITE_URL=https://your-domain.com npm run indexnow
 *
 * NOTE: Google does NOT use IndexNow. For Google, use Search Console →
 * "Request indexing" (see SEO-STRATEGY.md). This covers Bing + Yandex.
 *
 * It creates a key file at /public/<key>.txt (deploy it once so the search
 * engines can verify you own the domain), then submits every sitemap URL.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const raw = process.argv[2] || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
if (!raw) {
  console.error('\n✖ Missing site URL.  Usage: npm run indexnow -- https://your-domain.com\n');
  process.exit(1);
}
const siteUrl = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
const host = new URL(siteUrl).host;

// Reuse an existing key file if present, else make one.
let key = process.env.INDEXNOW_KEY || '';
if (!key) {
  const existing = fs.existsSync(publicDir)
    ? fs.readdirSync(publicDir).find((f) => /^[a-f0-9]{16,}\.txt$/.test(f))
    : null;
  key = existing ? existing.replace(/\.txt$/, '') : crypto.randomBytes(16).toString('hex');
}
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, `${key}.txt`), key);
console.log(`▸ Key file: public/${key}.txt  (deploy it so it's live at ${siteUrl}/${key}.txt)`);

// Pull URLs from the live sitemap.
let urls = [];
try {
  const xml = await (await fetch(`${siteUrl}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} catch {
  console.error(`✖ Could not fetch ${siteUrl}/sitemap.xml — is the site deployed and live?`);
  process.exit(1);
}
if (!urls.length) {
  console.error('✖ No URLs found in sitemap.');
  process.exit(1);
}
console.log(`▸ Submitting ${urls.length} URLs to IndexNow…`);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `${siteUrl}/${key}.txt`, urlList: urls }),
});

if (res.ok || res.status === 202) {
  console.log(`\n✅ Submitted. Bing & Yandex will index within hours.  (HTTP ${res.status})`);
  console.log('   For Google: Search Console → URL Inspection → Request indexing.\n');
} else {
  console.error(`\n! IndexNow returned HTTP ${res.status}. Make sure ${siteUrl}/${key}.txt is live, then retry.\n`);
}
