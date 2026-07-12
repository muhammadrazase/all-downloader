import type { ImageAsset } from './types';

/**
 * YouTube thumbnails — pure URL construction from the video id.
 * No server call, no API key, no bandwidth: runs entirely in the browser.
 */
export function youtubeThumbnails(url: string): ImageAsset[] {
  const id = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1];
  if (!id) return [];
  const at = (q: string) => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
  return [
    { label: 'Max HD (1280×720)', url: at('maxresdefault'), width: 1280, height: 720, ext: 'jpg' },
    { label: 'HQ (480×360)', url: at('hqdefault'), width: 480, height: 360, ext: 'jpg' },
    { label: 'SD (640×480)', url: at('sddefault'), width: 640, height: 480, ext: 'jpg' },
    { label: 'Medium (320×180)', url: at('mqdefault'), width: 320, height: 180, ext: 'jpg' },
  ];
}
