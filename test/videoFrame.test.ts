import { describe, it, expect } from 'vitest';
import { isVideoFile, assertGrabbable, VideoFrameError, MAX_INPUT_MB } from '@/lib/videoFrame';

function fileOfSize(bytes: number, name = 'clip.mp4', type = 'video/mp4'): File {
  const file = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('isVideoFile', () => {
  it('accepts anything the browser labels video/*', () => {
    expect(isVideoFile(new File([], 'clip.mp4', { type: 'video/mp4' }))).toBe(true);
  });

  it('falls back to the extension when the browser reports no MIME type', () => {
    for (const ext of ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']) {
      expect(isVideoFile(new File([], `clip.${ext}`, { type: '' }))).toBe(true);
    }
  });

  it('rejects non-video files', () => {
    expect(isVideoFile(new File([], 'photo.png', { type: 'image/png' }))).toBe(false);
    expect(isVideoFile(new File([], 'song.mp3', { type: 'audio/mpeg' }))).toBe(false);
  });
});

describe('assertGrabbable', () => {
  it('rejects a non-video file with a distinct not_video code', () => {
    try {
      assertGrabbable(new File([], 'doc.pdf', { type: 'application/pdf' }));
      expect.unreachable('expected assertGrabbable to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(VideoFrameError);
      expect((err as VideoFrameError).code).toBe('not_video');
    }
  });

  it(`rejects a file over ${MAX_INPUT_MB} MB`, () => {
    try {
      assertGrabbable(fileOfSize(MAX_INPUT_MB * 1024 * 1024 + 1));
      expect.unreachable('expected assertGrabbable to throw');
    } catch (err) {
      expect((err as VideoFrameError).code).toBe('too_large');
    }
  });

  it('accepts a video file within bounds — deliberately a much larger cap than the converters, since no re-encode happens here', () => {
    expect(() => assertGrabbable(fileOfSize(300 * 1024 * 1024))).not.toThrow();
  });
});

describe('VideoFrameError', () => {
  it('is a real Error subclass', () => {
    const err = new VideoFrameError('no frame', 'capture_failed');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('VideoFrameError');
  });
});
