import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkTrackRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { recordToolView, startAnalyticsFlushLoop } from '@/lib/analytics/collector';
import { countryOf, warmGeoTable } from '@/lib/analytics/geo';
import { PLATFORM_LIST } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rejects anything not a real tool slug, so a forged beacon can't write
// arbitrary strings into the aggregate table.
const VALID_TOOLS = new Set(
  [...PLATFORM_LIST, ...AI_TOOL_LIST, ...CONVERTER_LIST, ...IMAGE_TOOL_LIST, ...PDF_TOOL_LIST, ...FILE_TOOL_LIST].map(
    (t) => t.slug,
  ),
);

const schema = z.object({ tool: z.string().min(1).max(64) });
const MAX_BODY_BYTES = 512;

startAnalyticsFlushLoop();
warmGeoTable();

export async function POST(req: Request): Promise<NextResponse> {
  // Always 204, even on rejection — a tracking beacon has nothing useful to
  // tell a caller, and a differentiated response would just help probing.
  const done = () => new NextResponse(null, { status: 204 });

  const { success } = await checkTrackRateLimit(clientIp(req.headers));
  if (!success) return done();

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return done();

  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return done();
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success || !VALID_TOOLS.has(parsed.data.tool)) return done();

    const ip = clientIp(req.headers);
    const country = countryOf(ip);
    const userAgent = req.headers.get('user-agent') || '';
    recordToolView(parsed.data.tool, country, ip, userAgent);
  } catch {
    /* malformed beacon — nothing to do but return 204 */
  }
  return done();
}

export function GET(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
