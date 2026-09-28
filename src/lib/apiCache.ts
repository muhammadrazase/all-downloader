import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

// Cache-Control + ETag on a response that stays eligible for Next's own Full
// Route Cache / on-demand revalidation (no request headers read here — that
// would force the route dynamic and defeat the point).
export function cachedJson(data: unknown, maxAgeSec = 3600): NextResponse {
  const body = JSON.stringify(data);
  const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
  const cacheControl = `public, max-age=0, s-maxage=${maxAgeSec}, stale-while-revalidate=${maxAgeSec * 24}`;
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ETag: etag, 'Cache-Control': cacheControl },
  });
}
