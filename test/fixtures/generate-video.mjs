#!/usr/bin/env node
/**
 * Generates the tiny synthetic video corpus the converter tests run against
 * (test/fixtures/video). Requires ffmpeg on PATH (or $FFMPEG_PATH).
 *
 * Run: node test/fixtures/generate-video.mjs
 *
 * Everything here is solid-colour + sine-tone, so each file stays a few tens of
 * KB and is safe to commit — no third-party footage, no licensing question.
 * The clips are deliberately short: the single-thread ffmpeg.wasm core used in
 * the browser is ~10-20x slower than native, and these run inside E2E timeouts.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'video');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
mkdirSync(dir, { recursive: true });

function run(name, args) {
  const out = path.join(dir, name);
  execFileSync(ffmpeg, ['-nostdin', '-v', 'error', '-y', ...args, out]);
  console.log(`  wrote ${name} (${statSync(out).size} bytes)`);
}

// 1. The baseline clip: 1920x1080 so 720p/480p are real DOWNSCALES, and so the
//    480p target (1920/1080*480 = 853.33) exercises scale=-2's even rounding.
run('clip-1080p-3s.mp4', [
  '-f', 'lavfi', '-i', 'color=c=#2b6cb0:s=1920x1080:d=3:r=10',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
]);

// 2. No audio stream — `-vn -b:a 192k` has nothing to mux, so ffmpeg fails with "Output file
//    does not contain any stream": the real-world trigger for the stale-output-bug E2E test.
run('silent-360p-3s.mp4', [
  '-f', 'lavfi', '-i', 'color=c=#2b6cb0:s=640x360:d=3:r=10',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
]);

// 3. WebM/VP9+Opus: the converter advertises WebM input, and the mp4 outputs
//    use `-c:a copy`, so this is the codec-compatibility edge of that promise.
run('clip-vp9-opus-3s.webm', [
  '-f', 'lavfi', '-i', 'color=c=#2b6cb0:s=640x360:d=3:r=10',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
  '-c:v', 'libvpx-vp9', '-b:v', '200k', '-c:a', 'libopus', '-shortest',
]);

// 4. Not a video at all, wearing a .mp4 extension — passes the UI's
//    type/extension check and must still fail cleanly, not hang.
writeFileSync(path.join(dir, 'not-a-video.mp4'), 'This is plain text pretending to be an MP4.\n');
console.log('  wrote not-a-video.mp4');

// 5. Three 2s colour segments (red/green/blue) — a duration-only check can't tell a correct
//    trim from an offset one. Hex, not names: ffmpeg's "green" is #008000, not #00ff00.
run('clip-rgb-6s.mp4', [
  '-f', 'lavfi', '-i', 'color=c=#ff0000:s=640x360:d=2:r=10',
  '-f', 'lavfi', '-i', 'color=c=#00ff00:s=640x360:d=2:r=10',
  '-f', 'lavfi', '-i', 'color=c=#0000ff:s=640x360:d=2:r=10',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
  '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[outv]',
  '-map', '[outv]', '-map', '3:a',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
]);

// 6. 59.9667s — rounds to a whole minute at the UI's tenth-second display, exercising two clock-
//    edge bugs: the "0:60.0" formatter bug, and the playhead rounding past the clip's own end.
run('clip-minute-edge.mp4', [
  '-f', 'lavfi', '-i', 'color=c=#2b6cb0:s=320x180:r=30',
  '-frames:v', '1799', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
]);

console.log('\nVideo fixture generation complete.');
