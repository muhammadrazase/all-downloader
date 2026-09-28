import { exceedsCanvasLimits } from './imageCompress';

export class VideoFrameError extends Error {
  constructor(message: string, public readonly code: 'not_video' | 'too_large' | 'capture_failed') {
    super(message);
    this.name = 'VideoFrameError';
  }
}

// No ffmpeg re-encode happens here, so this tool can afford a larger cap than convert.ts's.
export const MAX_INPUT_MB = 500;
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;

/** Not shared with convert.ts's isVideoFile — that would pull ffmpeg plumbing in for nothing. */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
}

export function assertGrabbable(file: File): void {
  if (!isVideoFile(file)) throw new VideoFrameError('Not a video file', 'not_video');
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new VideoFrameError(`File exceeds ${MAX_INPUT_MB} MB`, 'too_large');
}

export type FrameFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export interface CaptureResult {
  blob: Blob;
  width: number;
  height: number;
}

/** Waits out an in-progress seek — capturing mid-seek risks drawing the frame from before it. */
function waitForSeekEnd(video: HTMLVideoElement): Promise<void> {
  if (!video.seeking) return Promise.resolve();
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
  });
}

/** Captures the current frame of an already-loaded <video> element via canvas. The caller owns
 * loading the file into the element and seeking to the desired timestamp. */
export async function captureFrame(video: HTMLVideoElement, format: FrameFormat, quality = 0.92): Promise<CaptureResult> {
  await waitForSeekEnd(video);
  const { videoWidth: width, videoHeight: height } = video;
  if (width === 0 || height === 0) throw new VideoFrameError('The video has no frame ready to capture yet.', 'capture_failed');
  if (exceedsCanvasLimits(width, height)) throw new VideoFrameError(`${width}×${height}px is larger than a browser canvas can hold.`, 'capture_failed');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new VideoFrameError('Canvas 2D context is not available in this browser.', 'capture_failed');
  ctx.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality));
  if (!blob) throw new VideoFrameError('Could not capture this frame.', 'capture_failed');
  return { blob, width, height };
}
