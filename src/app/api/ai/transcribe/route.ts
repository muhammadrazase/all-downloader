import { NextResponse } from 'next/server';
import { z } from 'zod';
import { detectPlatform } from '@/lib/platforms';
import { validateExtractTarget } from '@/lib/validate';
import { checkAiRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { transcribeConfigured, AiError } from '@/lib/ai';
import { transcribeUrl } from '@/lib/aiPipeline';

// Spawns yt-dlp + calls a provider → Node runtime, never statically optimized.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8_192; // a valid body is a few hundred bytes

const bodySchema = z.object({
  url: z.string().trim().url().max(2048),
  mode: z.enum(['transcribe', 'translate']).default('transcribe'),
});

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Rate-limit first (stricter AI bucket) — hostile probing costs nothing.
  const { success } = await checkAiRateLimit(clientIp(req));
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  // 2. Reject oversized bodies before buffering them into memory.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  }

  // 3. Parse + schema-validate.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please provide a valid video link.' }, { status: 400 });
  }
  const { url, mode } = parsed.data;

  // 3. SSRF: only known public platform hosts, never internal addresses.
  //    Reject bad/hostile input regardless of config (correct 400, not 503).
  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: 'That link is not from a supported platform. Paste a TikTok, YouTube, Instagram, X and other supported link.' },
      { status: 400 },
    );
  }
  const target = validateExtractTarget(url, platform.key);
  if (!target.ok) {
    return NextResponse.json({ error: target.reason ?? 'Unsupported link.' }, { status: 400 });
  }

  // 4. Feature gate — only well-formed, in-scope requests learn it's "coming soon".
  if (!transcribeConfigured()) {
    return NextResponse.json(
      { error: 'AI transcription is coming soon — it is not enabled on this server yet.', code: 'not_configured' },
      { status: 503 },
    );
  }

  try {
    const result = await transcribeUrl(url, mode);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('transcribe_failed', { platform: platform.key, reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
