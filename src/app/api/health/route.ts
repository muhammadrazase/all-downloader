import { existsSync } from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight health check for uptime monitors (UptimeRobot, BetterStack, etc.). */
export function GET(): Response {
  const mode = process.env.RAPIDAPI_KEY
    ? 'api'
    : process.env.ENGINE_URL
      ? 'remote'
      : 'local';

  // In local mode, confirm the yt-dlp binary is actually reachable.
  const ytdlpPath = process.env.YTDLP_PATH || '';
  const engineOk = mode !== 'local' || !ytdlpPath || existsSync(ytdlpPath);

  return Response.json(
    { status: engineOk ? 'ok' : 'degraded', engineMode: mode },
    { status: engineOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
