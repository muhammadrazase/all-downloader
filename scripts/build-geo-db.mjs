#!/usr/bin/env node
/**
 * build-geo-db.mjs — builds data/geo-ipv4.json, an IPv4-range → country table,
 * from the 5 Regional Internet Registries' own public "delegated-extended"
 * statistics files. No account, no API key, no license, no rate limit, no
 * paid tier — these are public allocation records the RIRs publish for
 * anyone to fetch over plain HTTPS. This replaces a MaxMind GeoLite2
 * dependency (free tier, but account/EULA-gated) with something the app
 * owns outright.
 *
 *   npm run build:geo
 *
 * Safe to re-run any time to refresh the data. If it fails (no network, a
 * mirror is down), the existing file — if any — is left untouched, and
 * country lookups just fall back to "ZZ" (see src/lib/analytics/geo.ts).
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'data', 'geo-ipv4.json');

const SOURCES = [
  'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-extended-latest',
  'https://ftp.apnic.net/stats/apnic/delegated-apnic-extended-latest',
  'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest',
  'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-extended-latest',
  'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest',
];
const TIMEOUT_MS = 45_000;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024; // RIR files run a few MB each; 64MB is a generous cap against a misbehaving mirror

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** Reads the response as text but aborts once MAX_RESPONSE_BYTES is exceeded,
 * so a misbehaving mirror can't balloon memory or disk. */
async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error(`${url} exceeded ${MAX_RESPONSE_BYTES}-byte cap`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

/** Parses one RIR file's "|country|ipv4|start|count|...|allocated|..." lines. */
function parseRanges(text) {
  const ranges = [];
  for (const line of text.split('\n')) {
    const cols = line.split('|');
    if (cols.length < 7) continue;
    const [, country, type, start, countStr, , status] = cols;
    if (type !== 'ipv4') continue;
    if (status !== 'allocated' && status !== 'assigned') continue;
    if (!country || country === '*' || country.length !== 2) continue;

    const startInt = ipv4ToInt(start);
    const count = Number(countStr);
    if (startInt === null || !Number.isFinite(count) || count <= 0) continue;

    ranges.push({ start: startInt, end: (startInt + count - 1) >>> 0, country: country.toUpperCase() });
  }
  return ranges;
}

/** Sorts by start, merges adjacent/overlapping ranges that share a country, and
 * trims overlaps between different countries so the output stays sorted and
 * disjoint — an invariant countryOf's binary search relies on. RIR allocation
 * pools shouldn't overlap in practice, but a source file's stale/duplicate
 * record shouldn't be able to violate that invariant either. */
function compact(ranges) {
  ranges.sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of ranges) {
    let start = r.start;
    const { end, country } = r;
    const last = out[out.length - 1];
    if (last) {
      if (start <= last.end && country !== last.country) {
        start = last.end + 1; // first-seen range wins the disputed span
        if (start > end) continue; // fully inside the previous range — drop it
      }
      if (start <= last.end + 1 && country === last.country) {
        last.end = Math.max(last.end, end);
        continue;
      }
    }
    out.push({ start, end, country });
  }
  return out;
}

async function main() {
  console.log(`Fetching ${SOURCES.length} public RIR delegation files…`);
  const results = await Promise.allSettled(SOURCES.map((url) => fetchText(url).then(parseRanges)));

  let all = [];
  let failures = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`  ✓ ${SOURCES[i]} (${r.value.length} ranges)`);
      all = all.concat(r.value);
    } else {
      failures++;
      console.warn(`  ✖ ${SOURCES[i]}: ${r.reason?.message ?? r.reason}`);
    }
  });

  if (all.length === 0) {
    console.error('✖ No data fetched from any registry — leaving any existing geo-ipv4.json untouched.');
    process.exit(existsSync(outFile) ? 0 : 1);
  }

  const merged = compact(all);
  // Flat number array — [start, end, countryCharCode0, countryCharCode1, ...] would
  // over-engineer this; a plain array of tuples is simple and still compact enough.
  const table = merged.map((r) => [r.start, r.end, r.country]);

  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(table));

  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(table)) / 1024);
  console.log(`\n✅ Wrote ${table.length} merged ranges (${sizeKb} KB) to ${path.relative(root, outFile)}`);
  if (failures > 0) console.log(`   (${failures} of ${SOURCES.length} registries were unreachable this run — table is partial but usable.)`);
}

main().catch((err) => {
  console.error('✖ Failed:', err.message);
  process.exit(existsSync(outFile) ? 0 : 1);
});
