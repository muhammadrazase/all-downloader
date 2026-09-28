export type ExportResolution = 'standard' | 'high';

/** pdf.js's viewport scale=1 is 72 DPI (1 PDF point = 1/72in) — standard targets ~144 DPI (screen), high ~288 DPI (print). */
export function computeExportScale(resolution: ExportResolution): number {
  return resolution === 'high' ? 4 : 2;
}

/** Sanitizes a name for use as a zip entry: unsanitized, `..\..\evil.pdf` would write outside the destination folder (zip slip); a name reducing to nothing falls back to a real word. */
export function sanitizeBaseName(name: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what must not reach a filename
  const cleaned = name.replace(/[/\\:*?"<>|\x00-\x1f]/g, '-').replace(/^[\s.-]+|[\s.]+$/g, '');
  return cleaned || 'pages';
}

/** Zero-pads the page number to `totalPages`' own digit width, so filenames sort correctly in a file browser or zip past page 9. */
export function buildPageImageFilename(baseName: string, pageNumber: number, totalPages: number, ext: 'jpg' | 'png'): string {
  const padded = String(pageNumber).padStart(String(totalPages).length, '0');
  return `${sanitizeBaseName(baseName)}-page-${padded}.${ext}`;
}
