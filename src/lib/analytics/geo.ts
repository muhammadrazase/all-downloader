import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Country-level only — never city. City-level location for every visitor is a
// materially larger privacy commitment than this feature needs; "roughly
// where visitors are from" is fully answered by country aggregates.
//
// Self-built, not a paid or account-gated service: `npm run build:geo`
// (scripts/build-geo-db.mjs) turns the public RIR delegation stats — no
// signup, no license key, no rate limit — into a sorted IPv4-range table.
// IPv6 isn't covered (a real scope cut, not an oversight) — those lookups
// fall back to 'ZZ', same as everything else when the table is absent.

const UNKNOWN = 'ZZ';

type RangeTable = [number, number, string][]; // [start, end, ISO country], sorted by start

function tablePath(): string {
  return process.env.GEOIP_DB_PATH || path.join(process.cwd(), 'data', 'geo-ipv4.json');
}

let table: RangeTable | null | undefined; // undefined = not yet attempted

// The file is our own build script's output, not user input, but a truncated
// write or a stale/corrupt copy shouldn't be trusted blindly either — fail
// open to "no table" (same as a missing file) rather than feed binarySearch
// a shape it doesn't expect.
function isValidTable(value: unknown): value is RangeTable {
  if (!Array.isArray(value)) return false;
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 3) return false;
    const [start, end, country] = entry;
    if (typeof start !== 'number' || typeof end !== 'number' || typeof country !== 'string') return false;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || country.length !== 2) return false;
  }
  return true;
}

function loadTable(): RangeTable | null {
  if (table !== undefined) return table;
  try {
    const file = tablePath();
    if (!existsSync(file)) {
      table = null;
    } else {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      table = isValidTable(parsed) ? parsed : null;
    }
  } catch {
    table = null;
  }
  return table;
}

/** Loads the table now instead of on the first real beacon, so the one-time
 * ~100ms synchronous read happens at startup, not inside a visitor's request. */
export function warmGeoTable(): void {
  loadTable();
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

function binarySearch(ranges: RangeTable, target: number): string | null {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const [start, end, country] = ranges[mid]!;
    if (target < start) hi = mid - 1;
    else if (target > end) lo = mid + 1;
    else return country;
  }
  return null;
}

export function countryOf(ip: string): string {
  if (!ip || ip === 'anon') return UNKNOWN;
  const target = ipv4ToInt(ip.trim());
  if (target === null) return UNKNOWN; // not a plain IPv4 literal (e.g. IPv6) — known scope cut

  const ranges = loadTable();
  if (!ranges) return UNKNOWN;

  try {
    return binarySearch(ranges, target) ?? UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** Test-only: force a fresh read of the table file on the next call. */
export function resetGeoReaderForTests(): void {
  table = undefined;
}
