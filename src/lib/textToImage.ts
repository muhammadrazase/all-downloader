/** Splits a single token that is wider than the line into chunks that fit — iterates code points so surrogate pairs stay intact. */
function breakLongWord(word: string, measure: (s: string) => number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of word) {
    const attempt = current + char;
    if (current && measure(attempt) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = attempt;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Pure word-wrap: takes a measure function instead of a canvas context so it is unit-testable without a real Canvas. */
export function wrapLines(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(' ')) {
      const attempt = current ? `${current} ${word}` : word;
      if (measure(attempt) <= maxWidth) {
        current = attempt;
        continue;
      }
      if (current) {
        lines.push(current);
        current = '';
      }
      if (measure(word) <= maxWidth) {
        current = word;
        continue;
      }
      // A single unbroken token (a long URL, say) wider than the line would otherwise
      // run off the edge of the canvas and be silently clipped.
      const chunks = breakLongWord(word, measure, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] ?? '';
    }
    lines.push(current);
  }
  return lines;
}

export type TextAlign = 'left' | 'center' | 'right';

export const FONT_FAMILIES = [
  { id: 'sans', label: 'Sans-serif', css: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Monospace', css: '"Courier New", monospace' },
] as const;

export const SIZE_PRESETS = [
  { id: 'auto', label: 'Fit text', width: 800, height: undefined },
  { id: 'square', label: 'Square post (1080×1080)', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait post (1080×1350)', width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape (1200×675)', width: 1200, height: 675 },
  { id: 'story', label: 'Story (1080×1920)', width: 1080, height: 1920 },
] as const;

export const MIN_FIT_FONT_SIZE = 10;

export interface TextImageOptions {
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  align: TextAlign;
  textColor: string;
  backgroundColor: string | null; // null = transparent (only meaningful for PNG export)
  width: number;
  height?: number; // fixed height with vertical centering; omitted = auto-fit to content
  padding: number;
  lineHeight: number; // multiplier of fontSize, e.g. 1.4
  shadow: boolean; // subtle drop shadow for readability over busy/transparent backgrounds
  shrinkToFit: boolean; // with a fixed height, scale the text down so the canvas keeps the exact preset size
}

interface Layout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  blockHeight: number;
}

function layoutText(ctx: CanvasRenderingContext2D, opts: TextImageOptions, fontSize: number): Layout {
  ctx.font = `${opts.bold ? 'bold ' : ''}${fontSize}px ${opts.fontFamily}`;
  const lines = wrapLines(opts.text, (s) => ctx.measureText(s).width, opts.width - opts.padding * 2);
  const lineHeight = fontSize * opts.lineHeight;
  return { lines, fontSize, lineHeight, blockHeight: lines.length * lineHeight };
}

/** Renders text onto a canvas, vertically centered at a fixed `height`; `shrinkToFit` scales type down to keep it exact, else the canvas grows instead of clipping. */
export function renderTextImage(opts: TextImageOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available in this browser.');

  let layout = layoutText(ctx, opts, opts.fontSize);
  if (opts.height && opts.shrinkToFit) {
    const available = opts.height - opts.padding * 2;
    while (layout.blockHeight > available && layout.fontSize > MIN_FIT_FONT_SIZE) {
      layout = layoutText(ctx, opts, layout.fontSize - 1);
    }
  }

  const canvasHeight = Math.round(Math.max(opts.height ?? 0, layout.blockHeight + opts.padding * 2));
  canvas.width = opts.width;
  canvas.height = canvasHeight;

  // Resizing a canvas resets its 2D context, so every drawing property has to be set again here.
  ctx.font = `${opts.bold ? 'bold ' : ''}${layout.fontSize}px ${opts.fontFamily}`;
  if (opts.backgroundColor) {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } // else leave transparent — canvas starts fully transparent by default

  if (opts.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = opts.textColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = opts.align;
  const x = opts.align === 'left' ? opts.padding : opts.align === 'right' ? opts.width - opts.padding : opts.width / 2;
  const startY = (canvasHeight - layout.blockHeight) / 2;
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * layout.lineHeight);
  });

  return canvas;
}

export function canvasToImageBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not generate the image.'));
    }, type);
  });
}
