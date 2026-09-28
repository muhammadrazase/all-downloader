import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordToolView, flush, resetCollectorForTests } from '@/lib/analytics/collector';
import { getAnalyticsDb } from '@/lib/analytics/db';
import { getDailySeries, getTotals, getTopTools, getTopCountries } from '@/lib/analytics/queries';

/**
 * The collector never writes to SQLite directly from recordToolView() — only
 * flush() does. This is the property that keeps analytics off the hot path.
 */

beforeEach(() => {
  resetCollectorForTests();
  getAnalyticsDb().exec('DELETE FROM tool_hits; DELETE FROM daily_totals;');
});

describe('recordToolView + flush', () => {
  afterEach(() => {
    vi.useRealTimers();
    getAnalyticsDb().exec('DROP TRIGGER IF EXISTS boom_trigger');
  });

  it('writes nothing to SQLite until flush() is called', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'ua-1');
    expect(getTotals(1).pageviews).toBe(0);

    flush();
    expect(getTotals(1).pageviews).toBe(1);
  });

  it('aggregates repeated views into one row with an incrementing count', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'ua-1');
    recordToolView('tiktok-downloader', 'US', '203.0.113.2', 'ua-2');
    recordToolView('tiktok-downloader', 'US', '203.0.113.3', 'ua-3');
    flush();

    const tools = getTopTools(1);
    expect(tools).toEqual([{ tool: 'tiktok-downloader', views: 3 }]);
  });

  it('separates counts by tool and by country', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'ua-1');
    recordToolView('merge-pdf', 'DE', '203.0.113.2', 'ua-2');
    flush();

    expect(getTopTools(1)).toEqual(
      expect.arrayContaining([
        { tool: 'tiktok-downloader', views: 1 },
        { tool: 'merge-pdf', views: 1 },
      ]),
    );
    expect(getTopCountries(1)).toEqual(
      expect.arrayContaining([
        { country: 'US', views: 1 },
        { country: 'DE', views: 1 },
      ]),
    );
  });

  it('counts the same ip+useragent once per day as one visitor, regardless of how many views', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'same-ua');
    recordToolView('merge-pdf', 'US', '203.0.113.1', 'same-ua');
    recordToolView('word-counter', 'US', '203.0.113.1', 'same-ua');
    flush();

    expect(getTotals(1).visitors).toBe(1);
    expect(getTotals(1).pageviews).toBe(3);
  });

  it('counts different visitors separately', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'ua-a');
    recordToolView('tiktok-downloader', 'US', '203.0.113.2', 'ua-b');
    flush();

    expect(getTotals(1).visitors).toBe(2);
  });

  it('never stores the raw ip or user agent — only aggregate counts', () => {
    recordToolView('tiktok-downloader', 'US', '198.51.100.42', 'Mozilla/5.0 secret-fingerprint');
    flush();

    const db = getAnalyticsDb();
    const dump = JSON.stringify(db.prepare('SELECT * FROM tool_hits').all());
    expect(dump).not.toContain('198.51.100.42');
    expect(dump).not.toContain('secret-fingerprint');
  });

  it('a second flush with no new views is a safe no-op', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'ua-1');
    flush();
    flush();
    expect(getTotals(1).pageviews).toBe(1);
  });

  it('getDailySeries reflects the flushed totals', () => {
    recordToolView('tiktok-downloader', 'US', '203.0.113.1', 'ua-1');
    flush();
    const series = getDailySeries(1);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ visitors: 1, pageviews: 1 });
  });

  it("does not lose an earlier day's data when a later day's write fails in the same flush", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    recordToolView('tiktok-downloader', 'US', '203.0.113.9', 'ua-day1');

    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    recordToolView('pdf-tool-boom', 'ZZ', '203.0.113.10', 'ua-day2');

    const db = getAnalyticsDb();
    db.exec(`
      CREATE TRIGGER boom_trigger BEFORE INSERT ON tool_hits
      WHEN NEW.tool = 'pdf-tool-boom'
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `);

    expect(() => flush()).toThrow();
    // The failed transaction rolled back both days' SQL writes...
    expect(getTotals(30).pageviews).toBe(0);

    db.exec('DROP TRIGGER boom_trigger');

    // ...but because nothing in memory was cleared until the transaction
    // actually committed, retrying recovers day1's view instead of it having
    // been silently wiped alongside day2's failure.
    flush();
    expect(getTopTools(30)).toEqual(
      expect.arrayContaining([
        { tool: 'tiktok-downloader', views: 1 },
        { tool: 'pdf-tool-boom', views: 1 },
      ]),
    );
  });
});
