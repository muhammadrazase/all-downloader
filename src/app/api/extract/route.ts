import { NextResponse } from 'next/server';
import { extractRequestSchema, validateExtractTarget } from '@/lib/validate';
import { extract, EngineError } from '@/lib/engine';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';

// Node runtime (the local engine spawns yt-dlp); never statically optimized.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Rate limit (abuse / bandwidth protection).
  const { success } = await checkRateLimit(clientIp(req));
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  // 2. Parse + schema-validate the body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = extractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please provide a valid link and platform.' }, { status: 400 });
  }
  const { url, platform } = parsed.data;

  // 3. SSRF guard + host whitelist.
  const target = validateExtractTarget(url, platform);
  if (!target.ok) {
    return NextResponse.json({ error: target.reason ?? 'Unsupported link.' }, { status: 400 });
  }

  // 4. Extract (timeout + typed failures handled in the engine).
  try {
    const result = await extract(url, platform);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof EngineError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Never leak internals to the client or logs.
    console.error('extract_failed', { platform, reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
