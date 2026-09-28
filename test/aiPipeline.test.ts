import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transcription } from '@/lib/ai';
import { extractAudio } from '@/lib/aiAudio';
import { transcribeAudio, chat, AiError } from '@/lib/ai';
import { transcribeUrl, summarizeUrl } from '@/lib/aiPipeline';
import { cacheKey, getCached } from '@/lib/aiCache';

/**
 * Orchestration for /video-to-text and /video-summary. The provider and yt-dlp
 * boundaries are mocked; what is asserted is the orchestration itself —
 * cache hits that skip providers, temp-file cleanup, and prompt composition.
 */

vi.mock('@/lib/aiAudio', () => ({ extractAudio: vi.fn() }));
vi.mock('@/lib/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai')>()),
  transcribeAudio: vi.fn(),
  chat: vi.fn(),
}));

const mockExtract = vi.mocked(extractAudio);
const mockTranscribe = vi.mocked(transcribeAudio);
const mockChat = vi.mocked(chat);
const cleanup = vi.fn();

// The module-level cache is shared across this file, so each case needs a fresh URL.
let urlCounter = 0;
const freshUrl = () => `https://www.youtube.com/watch?v=test${urlCounter++}`;

const transcription = (overrides: Partial<Transcription> = {}): Transcription => ({
  text: 'Hello world, this is the video.',
  segments: [
    { start: 0, end: 2, text: 'Hello world,' },
    { start: 2, end: 4.5, text: 'this is the video.' },
  ],
  language: 'en',
  provider: 'groq',
  ...overrides,
});

function chatArgs(index = 0) {
  const call = mockChat.mock.calls[index];
  if (!call) throw new Error(`chat() was not called ${index + 1} time(s)`);
  return { system: call[0], user: call[1], opts: call[2] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExtract.mockResolvedValue({ filePath: '/tmp/ssd-ai-test/audio.mp3', cleanup });
  mockTranscribe.mockResolvedValue(transcription());
  mockChat.mockResolvedValue({ text: '{"summary":"A short overview.","points":["One","Two"]}', provider: 'groq' });
});

describe('transcribeUrl', () => {
  it('returns the transcript with SRT and VTT built from the segments', async () => {
    const result = await transcribeUrl(freshUrl(), 'youtube');
    expect(result).toEqual({
      text: 'Hello world, this is the video.',
      srt: '1\n00:00:00,000 --> 00:00:02,000\nHello world,\n\n2\n00:00:02,000 --> 00:00:04,500\nthis is the video.\n',
      vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello world,\n\n00:00:02.000 --> 00:00:04.500\nthis is the video.\n',
      language: 'en',
      provider: 'groq',
    });
  });

  it('passes the platform to the extractor and the mode to the transcriber', async () => {
    const url = freshUrl();
    await transcribeUrl(url, 'tiktok', 'translate');
    expect(mockExtract).toHaveBeenCalledWith(url, 'tiktok');
    expect(mockTranscribe).toHaveBeenCalledWith('/tmp/ssd-ai-test/audio.mp3', 'translate');
  });

  it('deletes the temp audio exactly once on success', async () => {
    await transcribeUrl(freshUrl(), 'youtube');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('deletes the temp audio when transcription fails, and rethrows the typed error', async () => {
    mockTranscribe.mockRejectedValueOnce(new AiError('provider_failed', 'The transcription service is busy.', 502));
    await expect(transcribeUrl(freshUrl(), 'youtube')).rejects.toMatchObject({ code: 'provider_failed', status: 502 });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('propagates an extraction failure without calling a provider', async () => {
    mockExtract.mockRejectedValueOnce(new AiError('too_long', 'That video is too long.', 422));
    await expect(transcribeUrl(freshUrl(), 'youtube')).rejects.toMatchObject({ code: 'too_long' });
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('serves a repeat request from cache — no yt-dlp spawn, no provider call', async () => {
    const url = freshUrl();
    const first = await transcribeUrl(url, 'youtube');
    const second = await transcribeUrl(url, 'youtube');
    expect(second).toEqual(first);
    expect(mockExtract).toHaveBeenCalledOnce();
    expect(mockTranscribe).toHaveBeenCalledOnce();
  });

  it('caches translate separately from transcribe', async () => {
    const url = freshUrl();
    await transcribeUrl(url, 'youtube', 'transcribe');
    mockTranscribe.mockResolvedValueOnce(transcription({ text: 'Translated text.', language: 'en' }));
    const translated = await transcribeUrl(url, 'youtube', 'translate');
    expect(translated.text).toBe('Translated text.');
    expect(mockTranscribe).toHaveBeenCalledTimes(2);
  });

  it('keeps different URLs in different cache entries', async () => {
    await transcribeUrl(freshUrl(), 'youtube');
    await transcribeUrl(freshUrl(), 'youtube');
    expect(mockTranscribe).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure — the next request retries instead of replaying the error', async () => {
    const url = freshUrl();
    mockTranscribe.mockRejectedValueOnce(new AiError('provider_failed', 'busy', 502));
    await expect(transcribeUrl(url, 'youtube')).rejects.toMatchObject({ code: 'provider_failed' });
    await expect(transcribeUrl(url, 'youtube')).resolves.toMatchObject({ text: 'Hello world, this is the video.' });
    expect(mockTranscribe).toHaveBeenCalledTimes(2);
  });

  it('writes under a version-stamped cache key so a format change invalidates old entries', async () => {
    const url = freshUrl();
    await transcribeUrl(url, 'youtube');
    await expect(getCached(cacheKey('transcript', url, 'transcribe'))).resolves.toBeNull();
    await expect(getCached(cacheKey('transcript', url, 'v1:transcribe'))).resolves.toMatchObject({ provider: 'groq' });
  });
});

describe('summarizeUrl', () => {
  it('returns the parsed summary, key points and answering provider', async () => {
    await expect(summarizeUrl(freshUrl(), 'youtube')).resolves.toEqual({
      summary: 'A short overview.',
      points: ['One', 'Two'],
      provider: 'groq',
    });
  });

  it('asks for strict JSON and keeps the default provider order (no preferProvider on the video path)', async () => {
    await summarizeUrl(freshUrl(), 'youtube');
    expect(chatArgs().opts).toEqual({ json: true });
  });

  it('sends the rules as the system prompt and the transcript as delimited user content', async () => {
    await summarizeUrl(freshUrl(), 'youtube');
    const { system, user } = chatArgs();
    expect(system).toContain('Output ONLY minified JSON');
    expect(user).toContain('<transcript>\nHello world, this is the video.\n</transcript>');
  });

  it('serves a repeat summary from cache — no second provider call', async () => {
    const url = freshUrl();
    const first = await summarizeUrl(url, 'youtube');
    const second = await summarizeUrl(url, 'youtube');
    expect(second).toEqual(first);
    expect(mockChat).toHaveBeenCalledOnce();
    expect(mockTranscribe).toHaveBeenCalledOnce();
  });

  it('reuses an already-cached transcript instead of re-transcribing the video', async () => {
    const url = freshUrl();
    await transcribeUrl(url, 'youtube');
    await summarizeUrl(url, 'youtube');
    expect(mockExtract).toHaveBeenCalledOnce();
    expect(mockTranscribe).toHaveBeenCalledOnce();
    expect(mockChat).toHaveBeenCalledOnce();
  });

  it('does not cache a failed summary', async () => {
    const url = freshUrl();
    mockChat.mockRejectedValueOnce(new AiError('provider_failed', 'The AI service is busy.', 502));
    await expect(summarizeUrl(url, 'youtube')).rejects.toMatchObject({ code: 'provider_failed', status: 502 });
    await expect(summarizeUrl(url, 'youtube')).resolves.toMatchObject({ summary: 'A short overview.' });
  });

  it('writes under a version-stamped cache key', async () => {
    const url = freshUrl();
    await summarizeUrl(url, 'youtube');
    await expect(getCached(cacheKey('summary', url))).resolves.toBeNull();
    await expect(getCached(cacheKey('summary', url, 'v1'))).resolves.toMatchObject({ summary: 'A short overview.' });
  });
});

describe('summary reply parsing', () => {
  const summarise = async (reply: string) => {
    mockChat.mockResolvedValueOnce({ text: reply, provider: 'gemini' });
    return summarizeUrl(freshUrl(), 'youtube');
  };

  it('unwraps JSON surrounded by prose or code fences', async () => {
    const result = await summarise('```json\n{"summary":"Fenced.","points":["A"]}\n```');
    expect(result).toMatchObject({ summary: 'Fenced.', points: ['A'] });
  });

  it('drops non-string and blank key points', async () => {
    const result = await summarise('{"summary":"S","points":["good",3,"","  spaced  ",null]}');
    expect(result.points).toEqual(['good', 'spaced']);
  });

  it('tolerates a missing points array', async () => {
    const result = await summarise('{"summary":"Only a summary."}');
    expect(result).toMatchObject({ summary: 'Only a summary.', points: [] });
  });

  it('falls back to the raw reply as the summary when the model ignores JSON mode', async () => {
    const result = await summarise('This video explains how to bake bread.');
    expect(result).toMatchObject({ summary: 'This video explains how to bake bread.', points: [] });
  });

  it('falls back rather than returning an empty summary when the JSON parses but is blank', async () => {
    const result = await summarise('{"summary":"   ","points":["A"]}');
    expect(result.summary).toBe('{"summary":"   ","points":["A"]}');
  });
});

describe('transcript budgeting', () => {
  it('sends a short transcript untouched', async () => {
    mockTranscribe.mockResolvedValueOnce(transcription({ text: 'Short transcript.' }));
    await summarizeUrl(freshUrl(), 'youtube');
    expect(chatArgs().user).not.toContain('omitted for length');
  });

  it('keeps the opening AND the ending of a long transcript, where the conclusion lives', async () => {
    const text = `OPENING MARKER ${'filler word '.repeat(4000)} CLOSING MARKER`;
    mockTranscribe.mockResolvedValueOnce(transcription({ text }));
    await summarizeUrl(freshUrl(), 'youtube');

    const { user } = chatArgs();
    expect(user).toContain('OPENING MARKER');
    expect(user).toContain('CLOSING MARKER');
    expect(user).toContain('[…middle of the video omitted for length…]');
  });

  it('bounds the prompt near the free-tier budget however long the transcript is', async () => {
    mockTranscribe.mockResolvedValueOnce(transcription({ text: 'x'.repeat(500_000) }));
    await summarizeUrl(freshUrl(), 'youtube');
    expect(chatArgs().user.length).toBeLessThan(12_500);
  });
});
