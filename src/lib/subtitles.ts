import type { Segment } from './ai';

/**
 * Turn Whisper segments into standard subtitle files.
 *  - SRT  (SubRip)  → universal, works in VLC/YouTube/premiere.
 *  - VTT  (WebVTT)  → HTML5 <track>, web players.
 * Both are pure text; built server-side and handed to the client for download.
 */

function pad(n: number, width = 2): string {
  return String(Math.floor(n)).padStart(width, '0');
}

/** seconds → "HH:MM:SS,mmm" (comma for SRT) or "HH:MM:SS.mmm" (dot for VTT). */
function stamp(seconds: number, sep: ',' | '.'): string {
  const s = Math.max(0, seconds);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const total = Math.floor(s);
  return `${pad(total / 3600)}:${pad((total % 3600) / 60)}:${pad(total % 60)}${sep}${pad(ms, 3)}`;
}

export function toSrt(segments: Segment[]): string {
  return (
    segments
      .map((seg, i) => `${i + 1}\n${stamp(seg.start, ',')} --> ${stamp(seg.end, ',')}\n${seg.text}`)
      .join('\n\n') + '\n'
  );
}

export function toVtt(segments: Segment[]): string {
  const body = segments
    .map((seg) => `${stamp(seg.start, '.')} --> ${stamp(seg.end, '.')}\n${seg.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}
