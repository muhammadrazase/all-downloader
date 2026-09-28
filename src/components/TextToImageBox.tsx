'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { renderTextImage, canvasToImageBlob, FONT_FAMILIES, SIZE_PRESETS, type TextAlign } from '@/lib/textToImage';

const DEFAULT_TEXT = 'Type your text here…';

export function TextToImageBox() {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState<(typeof FONT_FAMILIES)[number]['id']>('sans');
  const [bold, setBold] = useState(false);
  const [align, setAlign] = useState<TextAlign>('left');
  const [textColor, setTextColor] = useState('#1a1a1a');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [transparentBg, setTransparentBg] = useState(false);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [padding, setPadding] = useState(32);
  const [shadow, setShadow] = useState(false);
  const [shrinkToFit, setShrinkToFit] = useState(true);
  const [preset, setPreset] = useState<(typeof SIZE_PRESETS)[number]['id']>('auto');
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [output, setOutput] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const presetDef = SIZE_PRESETS.find((p) => p.id === preset) ?? SIZE_PRESETS[0];
  const fontDef = FONT_FAMILIES.find((f) => f.id === fontFamily) ?? FONT_FAMILIES[0];
  const isFixedSize = presetDef.height !== undefined;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rendered = renderTextImage({
      text: text.trim() ? text : DEFAULT_TEXT,
      fontSize,
      fontFamily: fontDef.css,
      bold,
      align,
      textColor,
      backgroundColor: transparentBg ? null : backgroundColor,
      width: presetDef.width,
      height: presetDef.height,
      padding,
      lineHeight,
      shadow,
      shrinkToFit,
    });
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(rendered, 0, 0);
    setOutput({ width: rendered.width, height: rendered.height });
  }, [text, fontSize, fontDef, bold, align, textColor, backgroundColor, transparentBg, presetDef, padding, lineHeight, shadow, shrinkToFit]);

  useEffect(() => { render(); }, [render]);

  // JPEG has no alpha channel — force PNG whenever transparency is on, so the download actually stays transparent.
  useEffect(() => { if (transparentBg) setFormat('image/png'); }, [transparentBg]);

  const download = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToImageBlob(canvas, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'image/png' ? 'text-image.png' : 'text-image.jpg';
    a.click();
    URL.revokeObjectURL(url);
  }, [format]);

  return (
    <div className="w-full">
      <label htmlFor="tti-text" className="sr-only">Text to render</label>
      <textarea
        id="tti-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={DEFAULT_TEXT}
        rows={4}
        className="w-full resize-y rounded-lg border border-surface-border bg-surface p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Font
          <select aria-label="Font" value={fontFamily} onChange={(e) => setFontFamily(e.target.value as (typeof FONT_FAMILIES)[number]['id'])} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Font size ({fontSize}px)
          <input type="range" min={16} max={96} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="accent-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Text color
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-surface-border" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Background
          <input type="color" value={backgroundColor} disabled={transparentBg} onChange={(e) => setBackgroundColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-surface-border disabled:opacity-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Line height ({lineHeight.toFixed(1)}×)
          <input type="range" min={1} max={2.2} step={0.1} value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className="accent-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Padding ({padding}px)
          <input type="range" min={0} max={128} step={8} value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="accent-accent" />
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-muted">
          <input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} className="h-4 w-4 accent-accent" />
          Transparent background
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-muted">
          <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} className="h-4 w-4 accent-accent" />
          Text shadow
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Size
          <select aria-label="Size" value={preset} onChange={(e) => setPreset(e.target.value as (typeof SIZE_PRESETS)[number]['id'])} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            {SIZE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-sm text-ink-muted">
          <legend className="mb-[3px]">Align</legend>
          <div className="flex h-10 gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAlign(a)}
                aria-pressed={align === a}
                aria-label={`Align ${a}`}
                className={`flex-1 rounded-md border text-xs font-medium capitalize transition-colors ${align === a ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:bg-surface-soft'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Style
          <button
            type="button"
            onClick={() => setBold((b) => !b)}
            aria-pressed={bold}
            className={`h-10 rounded-md border text-sm font-medium transition-colors ${bold ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:bg-surface-soft'}`}
          >
            <span className="font-bold">B</span> Bold
          </button>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Download as
          <select aria-label="Download as" value={format} onChange={(e) => setFormat(e.target.value as 'image/png' | 'image/jpeg')} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="image/png">PNG</option>
            <option value="image/jpeg" disabled={transparentBg}>JPEG{transparentBg ? ' (needs a solid background)' : ''}</option>
          </select>
        </label>
      </div>

      {isFixedSize && (
        <label className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={shrinkToFit} onChange={(e) => setShrinkToFit(e.target.checked)} className="h-4 w-4 accent-accent" />
          Shrink text to fit the chosen size (otherwise the image gets taller)
        </label>
      )}

      <div
        className={`mt-4 overflow-x-auto rounded-lg border border-surface-border p-4 ${transparentBg ? '' : 'bg-surface-soft'}`}
        style={
          transparentBg
            ? {
                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              }
            : undefined
        }
      >
        <canvas ref={canvasRef} className="mx-auto max-w-full" />
      </div>

      <p aria-live="polite" className="mt-2 text-xs text-ink-muted">
        Output: {output.width} × {output.height} px · {format === 'image/png' ? 'PNG' : 'JPEG'}
      </p>

      <div className="mt-4">
        <button type="button" onClick={download} className="btn-accent w-full sm:w-auto">Download {format === 'image/png' ? 'PNG' : 'JPEG'}</button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 No AI, no upload — your image is drawn instantly in your browser.</p>
    </div>
  );
}
