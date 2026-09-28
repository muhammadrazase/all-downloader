import { NextResponse } from 'next/server';
import { z } from 'zod';
import { detectPlatform } from '@/lib/platforms';
import { validateExtractTarget } from '@/lib/validate';
import { checkAiRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { aiConfigured, transcribeConfigured, AiError } from '@/lib/ai';
import { summarizeUrl } from '@/lib/aiPipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8_192;
const bodySchema = z.object({ url: z.string().trim().url().max(2048) });

export async function POST(req: Request): Promise<NextResponse> {
  const { success } = await checkAiRateLimit(clientIp(req.headers));
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  // Content-Length is absent on a chunked request, so the byte count we
  // actually read is the guard that holds.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please provide a valid video link.' }, { status: 400 });
  }
  const { url } = parsed.data;

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

  // Summary needs BOTH transcription (Groq Whisper) and a chat model.
  if (!transcribeConfigured() || !aiConfigured()) {
    return NextResponse.json(
      { error: 'AI summaries are coming soon — they are not enabled on this server yet.', code: 'not_configured' },
      { status: 503 },
    );
  }

  try {
    const result = await summarizeUrl(url, platform.key);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('summary_failed', { platform: platform.key, reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
