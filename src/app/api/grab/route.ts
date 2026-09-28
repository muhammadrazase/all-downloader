import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { EngineError } from '@/lib/engine-error';
import { grabTiktokThumbnail } from '@/lib/imageEngine';
import { IMAGE_TOOLS, type ImageToolKey } from '@/lib/imageTools';
import { validateExtractTarget } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only server-mode image tools reach this route (YouTube thumbnail resolves client-side).
const schema = z.object({
  url: z.string().trim().url().max(2048),
  tool: z.enum(['tiktok-thumbnail']),
});


export async function POST(req: Request): Promise<NextResponse> {
  const { success } = await checkRateLimit(clientIp(req.headers));
  if (!success) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Please provide a valid link.' }, { status: 400 });

  const tool = IMAGE_TOOLS[parsed.data.tool as ImageToolKey];
  // SSRF + host whitelist (reuse the same guard; validateExtractTarget takes a platform-like key).
  if (!tool.hostPattern.test(parsed.data.url)) {
    return NextResponse.json({ error: `That does not look like a valid ${tool.name} link.` }, { status: 400 });
  }
  // Private-IP / protocol guard (platform arg is a formality here; host regex already matched).
  const guard = validateExtractTarget(parsed.data.url, 'tiktok');
  if (!guard.ok) return NextResponse.json({ error: guard.reason ?? 'Invalid link.' }, { status: 400 });

  try {
    const result = await grabTiktokThumbnail(parsed.data.url);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=21600' }, // 6h — direct CDN URLs
    });
  } catch (err) {
    if (err instanceof EngineError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('grab_failed', { tool: parsed.data.tool, reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
