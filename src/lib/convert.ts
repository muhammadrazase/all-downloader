/**
 * Client-side video conversion via ffmpeg.wasm (single-thread, self-hosted core).
 * Everything runs in the browser — the file never leaves the device (private, free).
 * Loaded via dynamic import so the ~32 MB wasm is fetched ONLY on converter pages,
 * lazily, and never enters the main bundle.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';

export type ConvertKind = 'mp3' | 'gif' | '720' | '480';

let ff: FFmpeg | null = null;

async function getEngine(): Promise<FFmpeg> {
  if (ff) return ff;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const instance = new FFmpeg();
  await instance.load({
    coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
  });
  ff = instance;
  return ff;
}

export interface ConvertResult {
  blob: Blob;
  filename: string;
}

const SPEC: Record<ConvertKind, { out: string; type: string; args: (input: string, out: string) => string[] }> = {
  mp3: { out: 'audio.mp3', type: 'audio/mpeg', args: (i, o) => ['-i', i, '-vn', '-b:a', '192k', o] },
  gif: {
    out: 'animation.gif',
    type: 'image/gif',
    args: (i, o) => ['-i', i, '-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0', o],
  },
  '720': { out: 'video-720p.mp4', type: 'video/mp4', args: (i, o) => ['-i', i, '-vf', 'scale=-2:720', '-c:a', 'copy', o] },
  '480': { out: 'video-480p.mp4', type: 'video/mp4', args: (i, o) => ['-i', i, '-vf', 'scale=-2:480', '-c:a', 'copy', o] },
};

/** Convert a user's file. onProgress reports 0–100. */
export async function convert(
  file: File,
  kind: ConvertKind,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  const engine = await getEngine();
  const spec = SPEC[kind];
  const input = 'input';

  const onProg = ({ progress }: { progress: number }) => onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(input, await fetchFile(file));
    await engine.exec(spec.args(input, spec.out));
    const data = await engine.readFile(spec.out);
    // data is Uint8Array; wrap in a Blob for a client-side download.
    const blob = new Blob([data as Uint8Array], { type: spec.type });
    return { blob, filename: spec.out };
  } finally {
    engine.off('progress', onProg);
  }
}
