import { Readable } from 'node:stream';
import { validateExtractTarget } from '@/lib/validate';
import { prepareDownload, EngineError } from '@/lib/engine';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { PLATFORMS, type PlatformKey } from '@/lib/platforms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_QUALITY = /^(audio|360|480|720|1080|1440|2160)$/;
// This route validates with validateExtractTarget and never runs the Zod schema,
// so it needs its own copy of the schema's 2048-char URL ceiling.
const MAX_URL_LENGTH = 2048;

export async function GET(req: Request): Promise<Response> {
  const { success } = await checkRateLimit(clientIp(req.headers));
  if (!success) return json({ error: 'Too many requests. Please wait a moment.' }, 429);

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('u') ?? '';
  const platform = searchParams.get('p') ?? '';
  const quality = searchParams.get('q') ?? '';

  // Validate platform, quality, then the URL (SSRF + host whitelist).
  // hasOwn, not `in`: `in` walks the prototype chain, so `p=__proto__` passed the
  // guard and then crashed on PLATFORMS['__proto__'].hostPattern being undefined.
  if (!Object.hasOwn(PLATFORMS, platform)) return json({ error: 'Unsupported platform.' }, 400);
  if (!VALID_QUALITY.test(quality)) return json({ error: 'Invalid quality.' }, 400);
  if (url.length > MAX_URL_LENGTH) return json({ error: 'That link is too long.' }, 413);
  const check = validateExtractTarget(url, platform as PlatformKey);
  if (!check.ok) return json({ error: check.reason ?? 'Invalid link.' }, 400);

  try {
    const dl = await prepareDownload(url, quality, platform as PlatformKey);
    const webStream = Readable.toWeb(dl.stream as Readable) as ReadableStream<Uint8Array>;
    const headers: Record<string, string> = {
      'Content-Type': dl.contentType,
      'Content-Disposition': `attachment; filename="${asciiName(dl.filename)}"; filename*=UTF-8''${encodeURIComponent(dl.filename)}`,
      'Cache-Control': 'no-store',
    };
    if (dl.size) headers['Content-Length'] = String(dl.size);
    return new Response(webStream, { headers });
  } catch (err) {
    if (err instanceof EngineError) return json({ error: err.message }, err.status);
    console.error('download_failed', { platform, quality, reason: (err as Error)?.name });
    return json({ error: 'Something went wrong preparing your download.' }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Strip characters that would break the ASCII filename fallback. */
function asciiName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
}
