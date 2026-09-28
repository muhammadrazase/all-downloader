import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetCollectorForTests, flush } from '@/lib/analytics/collector';
import { getAnalyticsDb } from '@/lib/analytics/db';
import { getTopTools } from '@/lib/analytics/queries';

vi.mock('@/lib/analytics/geo', () => ({ countryOf: () => 'US', warmGeoTable: () => {} }));

const { POST } = await import('@/app/api/track/route');

let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;

function post(body: unknown, ip = freshIp()): Promise<Response> {
  return POST(
    new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  resetCollectorForTests();
  getAnalyticsDb().exec('DELETE FROM tool_hits; DELETE FROM daily_totals;');
});

describe('POST /api/track', () => {
  it('always returns 204, even for a valid tool', async () => {
    const res = await post({ tool: 'tiktok-downloader' });
    expect(res.status).toBe(204);
  });

  it('records a view for a real registry tool slug', async () => {
    await post({ tool: 'tiktok-downloader' });
    flush();
    expect(getTopTools(1)).toEqual([{ tool: 'tiktok-downloader', views: 1 }]);
  });

  it('silently drops (still 204) a tool slug that is not in any registry', async () => {
    const res = await post({ tool: 'not-a-real-tool' });
    expect(res.status).toBe(204);
    flush();
    expect(getTopTools(1)).toEqual([]);
  });

  it('silently drops malformed JSON without throwing', async () => {
    const res = await POST(
      new Request('http://localhost/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': freshIp() },
        body: '{not json',
      }),
    );
    expect(res.status).toBe(204);
  });

  it('silently drops an oversized body', async () => {
    const res = await post({ tool: 'x'.repeat(10_000) });
    expect(res.status).toBe(204);
    flush();
    expect(getTopTools(1)).toEqual([]);
  });
});
