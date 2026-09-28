import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { getSetting, getBoolSetting } from './config/settings.server';
import { metaFromResponse, usableProviders, recordAiCall, type AiProvider } from './aiQuota';

/**
 * AI provider abstraction — the $0-forever core.
 *
 * Two capabilities, each key-gated and provider-independent:
 *   - transcribeAudio(): speech → text + timestamps   (Groq Whisper-large-v3)
 *   - chat():            transcript → summary/points   (Groq → Gemini fallback)
 *
 * Design rules:
 *   - Secrets are SERVER-ONLY (GROQ_API_KEY / GEMINI_API_KEY — never NEXT_PUBLIC).
 *   - No key configured → a typed AiError('not_configured', 503), never a crash.
 *   - Every call is timeout-bounded. On a provider 429/5xx, chat() falls to the next.
 *   - Free tiers stay free: callers cache by content, we keep prompts small.
 */

export type AiErrorCode = 'not_configured' | 'provider_failed' | 'too_long' | 'empty' | 'at_capacity';

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  constructor(code: AiErrorCode, message: string, status: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

// Lazy accessors (DB > env > default), not module-level consts: an admin-panel
// key save must take effect on the next call, not the next process restart.
const groqModel = () => getSetting('GROQ_MODEL') || 'llama-3.3-70b-versatile';
const groqWhisperModel = () => getSetting('GROQ_WHISPER_MODEL') || 'whisper-large-v3';
const geminiModel = () => getSetting('GEMINI_MODEL') || 'gemini-2.5-flash';

// One key per provider, deliberately: pooling several free accounts to multiply
// quota is against both providers' terms, and the downside is a ban that kills
// the feature permanently. Free capacity is stretched by caching + budget caps
// instead (see aiCache.ts / aiQuota.ts).
const groqKey = () => getSetting('GROQ_API_KEY') || '';
const geminiKey = () => getSetting('GEMINI_API_KEY') || '';
const hasGroqKey = () => Boolean(groqKey());
const hasGeminiKey = () => Boolean(geminiKey());

const TRANSCRIBE_TIMEOUT_MS = 120_000; // Whisper on a long clip
const CHAT_TIMEOUT_MS = 45_000;

/** Any AI feature usable at all? (chat can run on Groq OR Gemini). */
export const aiConfigured = (): boolean =>
  getBoolSetting('aiEnabled', true) && (hasGroqKey() || hasGeminiKey());
/** Transcription runs on Groq Whisper (best) OR Gemini's multimodal audio input. */
export const transcribeConfigured = (): boolean => aiConfigured();

const hasKeyFor = (provider: AiProvider) => (provider === 'groq' ? hasGroqKey() : hasGeminiKey());

// Gemini inline audio must fit in one request (~20 MB). At our 48 kbps mono this
// is ~40 min of audio; the 30-min duration cap upstream keeps us comfortably under.
const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024;

// ── Transcription (Groq Whisper) ────────────────────────────────────
export interface Segment {
  start: number;
  end: number;
  text: string;
}
export interface Transcription {
  text: string;
  segments: Segment[];
  language?: string;
  provider: 'groq' | 'gemini';
}

/** Raised when every provider is over its free daily budget or rate-limited. */
export function atCapacityError(): AiError {
  return new AiError('at_capacity', 'AI tools are at capacity right now. Please try again in a few hours.', 503);
}

/**
 * Transcribe a local audio file. Groq Whisper leads (best timestamps); Gemini's
 * multimodal audio input takes over when Groq has no key or no budget left.
 * `mode: 'translate'` returns English regardless of the source language.
 */
export async function transcribeAudio(
  filePath: string,
  mode: 'transcribe' | 'translate' = 'transcribe',
): Promise<Transcription> {
  if (!transcribeConfigured()) {
    throw new AiError('not_configured', 'Transcription is not enabled on this server yet.', 503);
  }

  const order = usableProviders(['groq', 'gemini']).filter(hasKeyFor);
  if (!order.length) throw atCapacityError();

  let lastError: unknown;
  for (const provider of order) {
    try {
      return provider === 'groq' ? await groqTranscribe(filePath, mode) : await geminiTranscribe(filePath, mode);
    } catch (e) {
      // A real "no speech"/"too long" result shouldn't trigger a wasteful retry.
      if (e instanceof AiError && (e.code === 'empty' || e.code === 'too_long')) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof AiError
    ? lastError
    : new AiError('provider_failed', 'The transcription service is busy. Please try again shortly.', 502);
}

async function groqTranscribe(
  filePath: string,
  mode: 'transcribe' | 'translate',
): Promise<Transcription> {
  const buf = readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/mpeg' }), basename(filePath));
  form.append('model', groqWhisperModel());
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');

  const endpoint =
    mode === 'translate'
      ? 'https://api.groq.com/openai/v1/audio/translations'
      : 'https://api.groq.com/openai/v1/audio/transcriptions';

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${groqKey()}` },
      body: form,
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
  } catch {
    recordAiCall('groq', 'error');
    throw new AiError('provider_failed', 'The transcription service timed out. Try a shorter video.', 504);
  }

  if (!res.ok) {
    recordAiCall('groq', res.status === 429 ? 'rate_limited' : 'error', metaFromResponse(res));
    // 413 = file too big (very long video); everything else is a generic provider failure.
    if (res.status === 413) throw new AiError('too_long', 'That video is too long to transcribe. Try one under 30 minutes.', 413);
    if (res.status === 429) throw atCapacityError();
    throw new AiError('provider_failed', 'The transcription service is busy. Please try again shortly.', 502);
  }
  recordAiCall('groq', 'ok', metaFromResponse(res));

  const data = (await res.json()) as { text?: string; language?: string; segments?: RawSegment[] };
  const text = (data.text ?? '').trim();
  if (!text) throw new AiError('empty', 'No speech was found in that video.', 422);

  const segments: Segment[] = Array.isArray(data.segments)
    ? data.segments
        .filter((s): s is RawSegment => typeof s?.text === 'string')
        .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: s.text.trim() }))
        .filter((s) => s.text.length > 0)
    : [];

  return { text, segments, language: data.language, provider: 'groq' };
}

interface RawSegment {
  start?: number;
  end?: number;
  text: string;
}

// ── Transcription via Gemini (multimodal audio) ─────────────────────
// Expert transcription brief: verbatim accuracy, clean readability, and
// subtitle-grade segmentation with reliable timestamps.
const GEMINI_TRANSCRIBE_RULES =
  'You are a professional transcriptionist producing broadcast-quality, subtitle-ready output.\n' +
  'Rules:\n' +
  '1. Transcribe the SPOKEN WORDS verbatim — do not paraphrase, summarize, censor, or add words that were not said.\n' +
  '2. Apply correct punctuation, capitalization, and standard spelling. Write numbers, dates, and named entities as a professional would.\n' +
  '3. Detect the primary spoken language and report it in the "language" field (BCP-47, e.g. "en", "es").\n' +
  '4. Segment for subtitles: one sentence or natural clause per segment, ideally ≤ 12 seconds and readable in one glance. Set "start"/"end" to the real spoken time in seconds (decimals allowed); segments must be in order and must not overlap.\n' +
  '5. Do NOT transcribe pure music, silence, applause, or sound effects as words. If a stretch is instrumental, skip it (leave a time gap) rather than inventing lyrics or filler.\n' +
  '6. Do not label or guess speaker names. Do not add commentary, notes, timestamps in the text, or markdown.\n' +
  'Output ONLY minified JSON: {"language":string,"segments":[{"start":number,"end":number,"text":string}]}. No code fences, no prose. If there is no intelligible speech, return {"language":"","segments":[]}.';
const GEMINI_TRANSCRIBE_PROMPT = `TASK: Transcribe this audio.\n${GEMINI_TRANSCRIBE_RULES}`;
const GEMINI_TRANSLATE_PROMPT =
  `TASK: Transcribe this audio, then translate every segment into natural, fluent English (keep meaning, not word-for-word). ` +
  `Set "language" to "en".\n${GEMINI_TRANSCRIBE_RULES}`;

async function geminiTranscribe(
  filePath: string,
  mode: 'transcribe' | 'translate',
): Promise<Transcription> {
  if (!geminiKey()) throw new AiError('not_configured', 'Transcription is not enabled on this server yet.', 503);
  const buf = readFileSync(filePath);
  if (buf.byteLength > GEMINI_INLINE_MAX_BYTES) {
    throw new AiError('too_long', 'That video is too long to transcribe. Try a shorter one.', 413);
  }

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${geminiKey()}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: 'audio/mp3', data: buf.toString('base64') } },
                { text: mode === 'translate' ? GEMINI_TRANSLATE_PROMPT : GEMINI_TRANSCRIBE_PROMPT },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
      },
    );
  } catch {
    recordAiCall('gemini', 'error');
    throw new AiError('provider_failed', 'The transcription service timed out. Try a shorter video.', 504);
  }
  if (!res.ok) {
    recordAiCall('gemini', res.status === 429 ? 'rate_limited' : 'error', metaFromResponse(res));
    if (res.status === 429) throw atCapacityError();
    throw new AiError('provider_failed', 'The transcription service is busy. Please try again shortly.', 502);
  }
  recordAiCall('gemini', 'ok', metaFromResponse(res));

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
  const parsed = parseTranscriptJson(raw);
  if (!parsed.segments.length) throw new AiError('empty', 'No speech was found in that video.', 422);

  const text = parsed.segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  return { text, segments: parsed.segments, language: parsed.language, provider: 'gemini' };
}

/** Tolerant parse of the model's JSON transcript (drops blank segments). */
function parseTranscriptJson(raw: string): { language?: string; segments: Segment[] } {
  const slice = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    const obj = JSON.parse(slice) as { language?: unknown; segments?: unknown };
    const language = typeof obj.language === 'string' ? obj.language : undefined;
    const segments: Segment[] = Array.isArray(obj.segments)
      ? obj.segments
          .filter((s): s is RawSegment => typeof (s as RawSegment)?.text === 'string')
          .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: s.text.trim() }))
          .filter((s) => s.text.length > 0)
      : [];
    return { language, segments };
  } catch {
    return { segments: [] };
  }
}

// ── Chat (Groq → Gemini fallback) ───────────────────────────────────
export interface ChatResult {
  text: string;
  provider: 'groq' | 'gemini';
}

/**
 * One reasoning call. Tries Groq first, falls back to Gemini on failure so a
 * single provider's rate limit or outage never takes the feature down.
 * `json: true` forces the provider into strict JSON mode (guaranteed parseable).
 *
 * `preferProvider: 'gemini'` flips that order. This exists for long
 * documents (PDF summaries): Gemini's free tier supports roughly a 1M-token
 * context window, so a whole document can be sent in one call rather than
 * truncated to fit the much smaller budget the video pipeline was built
 * around. Video routes never pass this — their behavior is unchanged.
 */
export async function chat(
  system: string,
  user: string,
  opts: { json?: boolean; preferProvider?: 'groq' | 'gemini' } = {},
): Promise<ChatResult> {
  if (!aiConfigured()) {
    throw new AiError('not_configured', 'AI features are not enabled on this server yet.', 503);
  }

  const base: AiProvider[] = opts.preferProvider === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  const order = usableProviders(base).filter(hasKeyFor);
  if (!order.length) throw atCapacityError();

  for (const provider of order) {
    try {
      const text = provider === 'groq' ? await groqChat(system, user, opts.json) : await geminiChat(system, user, opts.json);
      return { text, provider };
    } catch {
      /* try the next provider in order */
    }
  }

  throw new AiError('provider_failed', 'The AI service is busy. Please try again shortly.', 502);
}

async function groqChat(system: string, user: string, json?: boolean): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${groqKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: groqModel(),
      temperature: 0.3,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  if (!res.ok) {
    recordAiCall('groq', res.status === 429 ? 'rate_limited' : 'error', metaFromResponse(res));
    throw new Error(String(res.status));
  }
  recordAiCall('groq', 'ok', metaFromResponse(res));
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty');
  return text;
}

async function geminiChat(system: string, user: string, json?: boolean): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${geminiKey()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    recordAiCall('gemini', res.status === 429 ? 'rate_limited' : 'error', metaFromResponse(res));
    throw new Error(String(res.status));
  }
  recordAiCall('gemini', 'ok', metaFromResponse(res));
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('empty');
  return text;
}
