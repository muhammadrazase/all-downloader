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
  // Round to whole milliseconds FIRST: rounding the fraction on its own yields
  // 1000 at .9995+, emitting an invalid 4-digit field ("00:00:01,1000").
  const ms = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
  return `${pad(ms / 3_600_000)}:${pad((ms % 3_600_000) / 60_000)}:${pad((ms % 60_000) / 1000)}${sep}${pad(ms % 1000, 3)}`;
}

/** A blank line terminates a cue in both formats, so never emit one inside the text. */
function cueText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

export function toSrt(segments: Segment[]): string {
  return (
    segments
      .map((seg, i) => `${i + 1}\n${stamp(seg.start, ',')} --> ${stamp(seg.end, ',')}\n${cueText(seg.text)}`)
      .join('\n\n') + '\n'
  );
}

export function toVtt(segments: Segment[]): string {
  const body = segments
    .map((seg) => `${stamp(seg.start, '.')} --> ${stamp(seg.end, '.')}\n${cueText(seg.text)}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}
