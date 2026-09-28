import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AiErrorCode } from '@/lib/ai';
import { resetAiQuota } from '@/lib/aiQuota';

/**
 * Provider layer for /video-to-text and /video-summary. Keys are read at module
 * load, so every case re-imports the module under stubbed env (vi.resetModules).
 */

const GROQ_KEY = 'gsk_test_groq_key_DO_NOT_LEAK';
const GEMINI_KEY = 'AIza_test_gemini_key_DO_NOT_LEAK';
const GROQ_CHAT = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_HOST = 'generativelanguage.googleapis.com';

type FetchArgs = [input: string | URL | Request, init?: RequestInit];
const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>();

function loadAi(keys: { groq?: string; gemini?: string } = {}) {
  vi.resetModules();
  vi.stubEnv('GROQ_API_KEY', keys.groq ?? '');
  vi.stubEnv('GEMINI_API_KEY', keys.gemini ?? '');
  return import('@/lib/ai');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const groqChatReply = (text: string) => jsonResponse({ choices: [{ message: { content: text } }] });
const geminiReply = (text: string) => jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });

function callUrl(index: number): string {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`expected a fetch call at index ${index}, got ${fetchMock.mock.calls.length} calls`);
  return String(call[0]);
}

function callInit(index: number): RequestInit {
  const call = fetchMock.mock.calls[index];
  if (!call?.[1]) throw new Error(`expected init on fetch call ${index}`);
  return call[1];
}

function jsonBodyOf(index: number): Record<string, unknown> {
  const body = callInit(index).body;
  if (typeof body !== 'string') throw new Error('expected a JSON string body');
  return JSON.parse(body) as Record<string, unknown>;
}

function headerOf(index: number, name: string): string {
  const headers = callInit(index).headers;
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error('expected a header record');
  return (headers as Record<string, string>)[name] ?? '';
}

async function expectAiError(promise: Promise<unknown>, code: AiErrorCode, status: number): Promise<Error> {
  const err = await promise.then(
    () => {
      throw new Error('expected the call to reject');
    },
    (e: unknown) => e as Error,
  );
  expect(err).toMatchObject({ name: 'AiError', code, status });
  return err;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // A simulated 429 sets a real rate-limit cooldown, which would otherwise
  // make every later case see the provider as exhausted.
  resetAiQuota();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('chat() provider gating', () => {
  it('throws not_configured (503) and contacts nobody when no key is set', async () => {
    const { chat } = await loadAi();
    await expectAiError(chat('sys', 'user'), 'not_configured', 503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses Groq first by default', async () => {
    fetchMock.mockResolvedValue(groqChatReply('from groq'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user')).resolves.toEqual({ text: 'from groq', provider: 'groq' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(callUrl(0)).toBe(GROQ_CHAT);
  });

  it('uses Gemini first when preferProvider: "gemini" is passed', async () => {
    fetchMock.mockResolvedValue(geminiReply('from gemini'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user', { preferProvider: 'gemini' })).resolves.toEqual({
      text: 'from gemini',
      provider: 'gemini',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(callUrl(0)).toContain(GEMINI_HOST);
  });

  it('skips a provider with no key instead of burning a doomed request', async () => {
    fetchMock.mockResolvedValue(geminiReply('only option'));
    const { chat } = await loadAi({ gemini: GEMINI_KEY });
    await expect(chat('sys', 'user')).resolves.toMatchObject({ provider: 'gemini' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(callUrl(0)).toContain(GEMINI_HOST);
  });
});

describe('chat() fallback', () => {
  it('falls through to Gemini when Groq returns 5xx, and reports the provider that answered', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream exploded' }, 503))
      .mockResolvedValueOnce(geminiReply('rescued'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user')).resolves.toEqual({ text: 'rescued', provider: 'gemini' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callUrl(0)).toBe(GROQ_CHAT);
    expect(callUrl(1)).toContain(GEMINI_HOST);
  });

  it('falls through when Groq rate-limits (429) — the case the fallback exists for', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'rate limit' }, 429)).mockResolvedValueOnce(geminiReply('ok'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user')).resolves.toMatchObject({ provider: 'gemini' });
  });

  it('falls through when the network call itself throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(geminiReply('ok'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user')).resolves.toMatchObject({ provider: 'gemini' });
  });

  it('treats an empty completion as a failure and falls through rather than returning ""', async () => {
    fetchMock.mockResolvedValueOnce(groqChatReply('   ')).mockResolvedValueOnce(geminiReply('real answer'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user')).resolves.toEqual({ text: 'real answer', provider: 'gemini' });
  });

  it('falls back in the other direction too when Gemini is preferred and fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500)).mockResolvedValueOnce(groqChatReply('groq saved it'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(chat('sys', 'user', { preferProvider: 'gemini' })).resolves.toEqual({
      text: 'groq saved it',
      provider: 'groq',
    });
    expect(callUrl(0)).toContain(GEMINI_HOST);
    expect(callUrl(1)).toBe(GROQ_CHAT);
  });

  it('throws provider_failed (502) when both providers fail — never swallowed into an empty result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expectAiError(chat('sys', 'user'), 'provider_failed', 502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws provider_failed (502) with a single configured provider that fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const { chat } = await loadAi({ groq: GROQ_KEY });
    await expectAiError(chat('sys', 'user'), 'provider_failed', 502);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('chat() request shape', () => {
  it('sends the system prompt in the system slot, not merged into the user turn', async () => {
    // The system/user split is the prompt-injection boundary for transcript content.
    fetchMock.mockResolvedValue(groqChatReply('ok'));
    const { chat } = await loadAi({ groq: GROQ_KEY });
    await chat('SYSTEM RULES', 'USER CONTENT');
    const body = jsonBodyOf(0) as { messages: { role: string; content: string }[] };
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYSTEM RULES' },
      { role: 'user', content: 'USER CONTENT' },
    ]);
  });

  it('sends the system prompt as Gemini system_instruction', async () => {
    fetchMock.mockResolvedValue(geminiReply('ok'));
    const { chat } = await loadAi({ gemini: GEMINI_KEY });
    await chat('SYSTEM RULES', 'USER CONTENT');
    const body = jsonBodyOf(0) as {
      system_instruction: { parts: { text: string }[] };
      contents: { role: string; parts: { text: string }[] }[];
    };
    expect(body.system_instruction.parts[0]?.text).toBe('SYSTEM RULES');
    expect(body.contents[0]?.parts[0]?.text).toBe('USER CONTENT');
  });

  it('requests strict JSON mode from each provider when json: true', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500)).mockResolvedValueOnce(geminiReply('{}'));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await chat('sys', 'user', { json: true });
    expect(jsonBodyOf(0)).toMatchObject({ response_format: { type: 'json_object' } });
    expect(jsonBodyOf(1)).toMatchObject({ generationConfig: { responseMimeType: 'application/json' } });
  });

  it('omits JSON mode when not requested', async () => {
    fetchMock.mockResolvedValue(groqChatReply('ok'));
    const { chat } = await loadAi({ groq: GROQ_KEY });
    await chat('sys', 'user');
    expect(jsonBodyOf(0)).not.toHaveProperty('response_format');
  });

  it('bounds every provider call with an abort signal', async () => {
    fetchMock.mockResolvedValue(groqChatReply('ok'));
    const { chat } = await loadAi({ groq: GROQ_KEY });
    await chat('sys', 'user');
    expect(callInit(0).signal).toBeInstanceOf(AbortSignal);
  });
});

describe('chat() secret hygiene', () => {
  it('sends the Groq key as a bearer header and never in the URL', async () => {
    fetchMock.mockResolvedValue(groqChatReply('ok'));
    const { chat } = await loadAi({ groq: GROQ_KEY });
    await chat('sys', 'user');
    expect(headerOf(0, 'authorization')).toBe(`Bearer ${GROQ_KEY}`);
    expect(callUrl(0)).not.toContain(GROQ_KEY);
  });

  it('never leaks a key or a raw provider body into the thrown error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: `invalid api key ${GROQ_KEY}` } }, 401));
    const { chat } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    const err = await expectAiError(chat('sys', 'user'), 'provider_failed', 502);
    const serialised = `${err.message} ${err.stack ?? ''}`;
    expect(serialised).not.toContain(GROQ_KEY);
    expect(serialised).not.toContain(GEMINI_KEY);
    expect(serialised).not.toContain('invalid api key');
    expect(err.message).toBe('The AI service is busy. Please try again shortly.');
  });
});

describe('transcribeAudio()', () => {
  let dir: string;
  let audioPath: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'ssd-ai-test-'));
    audioPath = path.join(dir, 'audio.mp3');
    writeFileSync(audioPath, Buffer.from('fake mp3 bytes'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const whisperReply = (overrides: Record<string, unknown> = {}) =>
    jsonResponse({
      text: '  Hello world.  ',
      language: 'en',
      segments: [
        { start: 0, end: 1.5, text: ' Hello ' },
        { start: 1.5, end: 2, text: 'world.' },
      ],
      ...overrides,
    });

  it('throws not_configured (503) with no keys and contacts nobody', async () => {
    const { transcribeAudio } = await loadAi();
    await expectAiError(transcribeAudio(audioPath), 'not_configured', 503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('transcribes via Groq Whisper, trimming text and mapping segments', async () => {
    fetchMock.mockResolvedValue(whisperReply());
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY });
    await expect(transcribeAudio(audioPath)).resolves.toEqual({
      text: 'Hello world.',
      language: 'en',
      provider: 'groq',
      segments: [
        { start: 0, end: 1.5, text: 'Hello' },
        { start: 1.5, end: 2, text: 'world.' },
      ],
    });
    expect(callUrl(0)).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(headerOf(0, 'authorization')).toBe(`Bearer ${GROQ_KEY}`);
  });

  it('hits the translations endpoint in translate mode', async () => {
    fetchMock.mockResolvedValue(whisperReply());
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY });
    await transcribeAudio(audioPath, 'translate');
    expect(callUrl(0)).toBe('https://api.groq.com/openai/v1/audio/translations');
  });

  it('drops blank segments and coerces missing timings to 0', async () => {
    fetchMock.mockResolvedValue(
      whisperReply({
        segments: [
          { start: 'x', end: null, text: 'kept' },
          { start: 1, end: 2, text: '   ' },
          { text: 'also kept' },
          { start: 3, end: 4 },
        ],
      }),
    );
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY });
    const result = await transcribeAudio(audioPath);
    expect(result.segments).toEqual([
      { start: 0, end: 0, text: 'kept' },
      { start: 0, end: 0, text: 'also kept' },
    ]);
  });

  it('tolerates a response with no segments array at all', async () => {
    fetchMock.mockResolvedValue(whisperReply({ segments: undefined }));
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY });
    await expect(transcribeAudio(audioPath)).resolves.toMatchObject({ segments: [], text: 'Hello world.' });
  });

  it('falls back to Gemini when Groq fails, and reports gemini as the provider', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(geminiReply('{"language":"es","segments":[{"start":0,"end":1,"text":"Hola"}]}'));
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expect(transcribeAudio(audioPath)).resolves.toEqual({
      text: 'Hola',
      language: 'es',
      provider: 'gemini',
      segments: [{ start: 0, end: 1, text: 'Hola' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on Groq 413 — a too-long file fails the same way on Gemini', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 413));
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expectAiError(transcribeAudio(audioPath), 'too_long', 413);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does NOT retry when Groq reports no speech — the second provider would burn quota for nothing', async () => {
    fetchMock.mockResolvedValue(whisperReply({ text: '   ' }));
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY, gemini: GEMINI_KEY });
    await expectAiError(transcribeAudio(audioPath), 'empty', 422);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('surfaces provider_failed (502) when Groq fails and no fallback key exists', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY });
    await expectAiError(transcribeAudio(audioPath), 'provider_failed', 502);
  });

  it('maps a transport failure to a 504 timeout message, not a crash', async () => {
    fetchMock.mockRejectedValue(new Error('aborted'));
    const { transcribeAudio } = await loadAi({ groq: GROQ_KEY });
    const err = await expectAiError(transcribeAudio(audioPath), 'provider_failed', 504);
    expect(err.message).toContain('timed out');
  });

  it('parses a Gemini transcript that arrives wrapped in prose or code fences', async () => {
    fetchMock.mockResolvedValue(
      geminiReply('```json\n{"language":"en","segments":[{"start":0,"end":1,"text":"a"},{"start":1,"end":2,"text":"b"}]}\n```'),
    );
    const { transcribeAudio } = await loadAi({ gemini: GEMINI_KEY });
    await expect(transcribeAudio(audioPath)).resolves.toMatchObject({ text: 'a b', provider: 'gemini' });
  });

  it('reports empty (422) when Gemini returns unparseable output', async () => {
    fetchMock.mockResolvedValue(geminiReply('I am sorry, I cannot help with that.'));
    const { transcribeAudio } = await loadAi({ gemini: GEMINI_KEY });
    await expectAiError(transcribeAudio(audioPath), 'empty', 422);
  });

  it('reports empty (422) when Gemini finds no speech', async () => {
    fetchMock.mockResolvedValue(geminiReply('{"language":"","segments":[]}'));
    const { transcribeAudio } = await loadAi({ gemini: GEMINI_KEY });
    await expectAiError(transcribeAudio(audioPath), 'empty', 422);
  });

  it('rejects an oversized file before uploading it to Gemini', async () => {
    const bigPath = path.join(dir, 'big.mp3');
    writeFileSync(bigPath, Buffer.alloc(18 * 1024 * 1024 + 1));
    const { transcribeAudio } = await loadAi({ gemini: GEMINI_KEY });
    await expectAiError(transcribeAudio(bigPath), 'too_long', 413);
    expect(fetchMock).not.toHaveBeenCalled();
    rmSync(bigPath, { force: true });
  });

  it('never leaks a key or a provider body into the thrown error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: `bad key ${GEMINI_KEY}` }, 401));
    const { transcribeAudio } = await loadAi({ gemini: GEMINI_KEY });
    const err = await expectAiError(transcribeAudio(audioPath), 'provider_failed', 502);
    expect(`${err.message} ${err.stack ?? ''}`).not.toContain(GEMINI_KEY);
  });
});
