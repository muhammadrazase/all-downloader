import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { countryOf, resetGeoReaderForTests } from '@/lib/analytics/geo';

describe('countryOf — fails open when the table file is missing', () => {
  beforeEach(() => {
    // Point at a path that is guaranteed not to exist, regardless of whether
    // `npm run build:geo` has ever been run in this working copy.
    process.env.GEOIP_DB_PATH = '/tmp/definitely-does-not-exist-ssd-geo-test.json';
    resetGeoReaderForTests();
  });

  it('returns ZZ when the table file is absent', () => {
    expect(countryOf('8.8.8.8')).toBe('ZZ');
  });

  it('returns ZZ for an empty or anonymous ip without touching the table', () => {
    expect(countryOf('')).toBe('ZZ');
    expect(countryOf('anon')).toBe('ZZ');
  });

  it('returns ZZ instead of throwing for a garbage ip string', () => {
    expect(() => countryOf('not-an-ip')).not.toThrow();
    expect(countryOf('not-an-ip')).toBe('ZZ');
  });

  it('returns ZZ for an IPv6 address (a stated scope cut, not a bug)', () => {
    expect(countryOf('2001:4860:4860::8888')).toBe('ZZ');
  });
});

describe('countryOf — resolves against a real table', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ssd-geo-test-'));
  const tableFile = path.join(tmpDir, 'geo-ipv4.json');

  // [start, end, country] — 1.2.3.0/24 -> AU, 5.6.7.0/24 -> DE, ints precomputed.
  const ipv4 = (a: number, b: number, c: number, d: number) => ((a * 256 + b) * 256 + c) * 256 + d;
  writeFileSync(
    tableFile,
    JSON.stringify([
      [ipv4(1, 2, 3, 0), ipv4(1, 2, 3, 255), 'AU'],
      [ipv4(5, 6, 7, 0), ipv4(5, 6, 7, 255), 'DE'],
    ]),
  );

  afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

  beforeEach(() => {
    process.env.GEOIP_DB_PATH = tableFile;
    resetGeoReaderForTests();
  });

  it('finds the correct country for an ip inside a range', () => {
    expect(countryOf('1.2.3.42')).toBe('AU');
    expect(countryOf('5.6.7.200')).toBe('DE');
  });

  it('returns ZZ for an ip outside every range', () => {
    expect(countryOf('9.9.9.9')).toBe('ZZ');
  });

  it('is exact at range boundaries (binary search off-by-one check)', () => {
    expect(countryOf('1.2.3.0')).toBe('AU');
    expect(countryOf('1.2.3.255')).toBe('AU');
    expect(countryOf('1.2.4.0')).toBe('ZZ');
    expect(countryOf('1.2.2.255')).toBe('ZZ');
  });
});

describe('countryOf — fails open when the table file is corrupt', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ssd-geo-corrupt-test-'));
  const tableFile = path.join(tmpDir, 'geo-ipv4.json');

  afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

  beforeEach(() => {
    process.env.GEOIP_DB_PATH = tableFile;
    resetGeoReaderForTests();
  });

  it('rejects a table that is not an array', () => {
    writeFileSync(tableFile, JSON.stringify({ oops: 'not an array' }));
    expect(countryOf('8.8.8.8')).toBe('ZZ');
  });

  it('rejects entries with the wrong shape or types', () => {
    writeFileSync(tableFile, JSON.stringify([['not-a-number', 5, 'US']]));
    expect(countryOf('8.8.8.8')).toBe('ZZ');
  });

  it('rejects a country code that is not exactly 2 characters', () => {
    writeFileSync(tableFile, JSON.stringify([[0, 100, 'USA']]));
    expect(countryOf('0.0.0.1')).toBe('ZZ');
  });

  it('rejects invalid JSON outright', () => {
    writeFileSync(tableFile, '{not json');
    expect(countryOf('8.8.8.8')).toBe('ZZ');
  });
});
