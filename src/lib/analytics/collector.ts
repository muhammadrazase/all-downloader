import { createHash, randomBytes } from 'node:crypto';
import { analyticsStmt } from './db';

// Every /api/track hit only touches an in-memory Map — never SQLite directly.
// A timer flushes the aggregate to disk once a minute, so hitting "record a
// view" never queues behind (or blocks) an admin login on the same process.

interface Bucket {
  hits: Map<string, number>; // key: `${hour}|${tool}|${country}` -> count
  visitors: Set<string>; // salted, truncated hash — see visitorHash()
  pageviews: number;
}

const buckets = new Map<string, Bucket>(); // key: UTC day 'YYYY-MM-DD'
const MAX_VISITORS_PER_DAY = 200_000; // ~8MB of hashes; beyond this we stop counting new ones
let daySalt = { day: '', value: '' };

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function bucketFor(day: string): Bucket {
  let b = buckets.get(day);
  if (!b) {
    b = { hits: new Map(), visitors: new Set(), pageviews: 0 };
    buckets.set(day, b);
  }
  return b;
}

/**
 * Unlinkable-by-tomorrow visitor id: hashed with a salt that's random per
 * process-day and never persisted, so nothing here can identify a return
 * visitor across days, let alone a real person. Only the resulting COUNT is
 * ever written to disk — the hash itself never leaves this function.
 */
function visitorHash(ip: string, userAgent: string, day: string): string {
  if (daySalt.day !== day) daySalt = { day, value: randomBytes(32).toString('hex') };
  return createHash('sha256').update(`${daySalt.value}:${ip}:${userAgent}`).digest('hex').slice(0, 16);
}

export function recordToolView(tool: string, country: string, ip: string, userAgent: string): void {
  const day = utcDay();
  const hour = new Date().getUTCHours();
  const bucket = bucketFor(day);

  const key = `${hour}|${tool}|${country}`;
  bucket.hits.set(key, (bucket.hits.get(key) ?? 0) + 1);
  bucket.pageviews++;

  if (bucket.visitors.size < MAX_VISITORS_PER_DAY) {
    bucket.visitors.add(visitorHash(ip, userAgent, day));
  }
}

/** Flushes every day bucket to SQLite in one transaction, then clears in-memory state for finished days. */
export function flush(): void {
  const today = utcDay();
  if (buckets.size === 0) return;

  const upsertHit = analyticsStmt(
    `INSERT INTO tool_hits (day, hour, tool, country, hits) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day, hour, tool, country) DO UPDATE SET hits = hits + excluded.hits`,
  );
  const upsertTotals = analyticsStmt(
    `INSERT INTO daily_totals (day, visitors, pageviews) VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       visitors = MAX(visitors, excluded.visitors),
       pageviews = pageviews + excluded.pageviews`,
  );

  // Snapshot first, write second, clear third — so a failed transaction (disk
  // full, SQLITE_BUSY) leaves the in-memory buckets untouched for a retry on
  // the next tick, instead of losing data that was cleared but never persisted.
  const snapshot = Array.from(buckets, ([day, bucket]) => ({
    day,
    hits: Array.from(bucket.hits),
    visitors: bucket.visitors.size,
    pageviews: bucket.pageviews,
  }));

  const db = upsertHit.database;
  const applyAll = db.transaction(() => {
    for (const { day, hits, visitors, pageviews } of snapshot) {
      for (const [key, count] of hits) {
        const [hourStr, tool, country] = key.split('|');
        upsertHit.run(day, Number(hourStr), tool, country, count);
      }
      upsertTotals.run(day, visitors, pageviews);
    }
  });
  applyAll(); // throws on failure — nothing below runs, so nothing in-memory is lost

  for (const { day } of snapshot) {
    const bucket = buckets.get(day);
    if (!bucket) continue;
    bucket.hits.clear();
    bucket.pageviews = 0;
    // Keep `visitors` accumulating through the day (so the daily count stays
    // correct on the next flush); only fully drop days that have ended.
    if (day !== today) buckets.delete(day);
  }
}

// A plain module-level flag isn't enough here: Next's dev server can
// re-instantiate this module per request without restarting the process
// (observed as SIGTERM/SIGINT listeners piling up under load), so the guard
// has to live on `globalThis` — same reasoning as the DB singletons.
declare global {
  // eslint-disable-next-line no-var
  var __ssdAnalyticsLoopStarted: boolean | undefined;
}

/** Idempotent — safe to call from multiple modules that all want the flush loop running. */
export function startAnalyticsFlushLoop(intervalMs = 60_000): void {
  if (globalThis.__ssdAnalyticsLoopStarted || process.env.VITEST) return;
  globalThis.__ssdAnalyticsLoopStarted = true;

  const timer = setInterval(() => {
    try {
      flush();
    } catch {
      /* best-effort; never let a flush failure crash the process */
    }
  }, intervalMs);
  timer.unref?.();
  const stop = () => {
    clearInterval(timer);
    try {
      flush();
    } catch {
      /* shutting down anyway */
    }
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

/** Test-only: drop all in-memory state. */
export function resetCollectorForTests(): void {
  buckets.clear();
  daySalt = { day: '', value: '' };
}
