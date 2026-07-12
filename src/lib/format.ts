/** Map a technical quality/ext to a plain-language button label. */
export function humanFormatLabel(quality: string, ext: string): string {
  if (quality === 'audio') return `Audio · ${ext.toUpperCase()}`;
  const height = parseInt(quality);
  const tier =
    height >= 2160 ? '4K' : height >= 1440 ? '2K' : height >= 1080 ? 'HD 1080p' : height >= 720 ? 'HD 720p' : `${height}p`;
  return `${tier} · ${ext.toUpperCase()}`;
}
