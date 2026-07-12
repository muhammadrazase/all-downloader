import { transcribeAudio, chat, type Transcription } from './ai';
import { extractAudio } from './aiAudio';
import { toSrt, toVtt } from './subtitles';
import { cacheKey, getCached, setCached } from './aiCache';

/**
 * Orchestration layer used by the AI routes. Each step caches by content so a
 * repeat request for the same URL never re-hits a provider — the core of the
 * $0-forever budget. The routes handle validation/SSRF/rate-limit before calling in.
 */

export interface TranscriptResult {
  text: string;
  srt: string;
  vtt: string;
  language?: string;
  provider: string;
}

/** URL → transcript + subtitle files (cached). `mode: 'translate'` → English. */
export async function transcribeUrl(
  url: string,
  mode: 'transcribe' | 'translate' = 'transcribe',
): Promise<TranscriptResult> {
  const key = cacheKey('transcript', url, mode);
  const cached = await getCached<TranscriptResult>(key);
  if (cached) return cached;

  const audio = await extractAudio(url);
  let transcription: Transcription;
  try {
    transcription = await transcribeAudio(audio.filePath, mode);
  } finally {
    audio.cleanup();
  }

  const result: TranscriptResult = {
    text: transcription.text,
    srt: toSrt(transcription.segments),
    vtt: toVtt(transcription.segments),
    language: transcription.language,
    provider: transcription.provider,
  };
  await setCached(key, result);
  return result;
}

export interface SummaryResult {
  summary: string;
  points: string[];
  provider: string;
}

const SUMMARY_SYSTEM =
  'You are a senior editor who writes tight, high-signal video summaries for people deciding whether to watch. ' +
  'You are given only the transcript of the audio; base everything strictly on it.\n' +
  'Rules:\n' +
  '1. GROUNDING: Use only what the transcript actually says. Never invent facts, names, numbers, or conclusions. If the transcript is unclear, sparse, or mostly music/filler, say so plainly rather than padding.\n' +
  '2. SUMMARY: 2–4 sentences capturing what the video is about and its outcome or main argument — specific and information-dense, not vague ("discusses various things" is forbidden). Neutral, factual tone; no hype, no marketing, no second person.\n' +
  '3. KEY POINTS: 3–6 concrete, standalone takeaways a reader gets value from without watching — the actual claims, steps, facts, or conclusions, each ≤ 20 words. No generic filler ("the speaker talks about X"). Order by importance. If the transcript genuinely has fewer than 3 substantive points, return only the real ones.\n' +
  '4. Match the transcript language for the output text.\n' +
  'Output ONLY minified JSON: {"summary":string,"points":string[]}. No markdown, no code fences, no extra keys.';

/** URL → transcript (cached) → AI summary + key points (cached). */
export async function summarizeUrl(url: string): Promise<SummaryResult> {
  const key = cacheKey('summary', url);
  const cached = await getCached<SummaryResult>(key);
  if (cached) return cached;

  const { text } = await transcribeUrl(url);

  const { text: raw, provider } = await chat(
    SUMMARY_SYSTEM,
    `Summarize this video. Transcript below (between the markers):\n<transcript>\n${budgetTranscript(text)}\n</transcript>`,
    { json: true },
  );

  const result: SummaryResult = { ...parseSummary(raw), provider };
  await setCached(key, result);
  return result;
}

/**
 * Fit a transcript into the free-tier token budget WITHOUT losing the ending.
 * A naive head-truncate drops the conclusion (where videos land their point);
 * for long transcripts we keep the opening + the closing so the model sees both.
 */
const SUMMARY_CHAR_BUDGET = 12_000; // ~3k tokens — safe under Groq's 6k TPM free limit
function budgetTranscript(text: string): string {
  if (text.length <= SUMMARY_CHAR_BUDGET) return text;
  const head = Math.floor(SUMMARY_CHAR_BUDGET * 0.7);
  const tail = SUMMARY_CHAR_BUDGET - head;
  return `${text.slice(0, head).trim()}\n\n[…middle of the video omitted for length…]\n\n${text.slice(-tail).trim()}`;
}

/** Tolerant parse: models occasionally wrap JSON in prose or code fences. */
function parseSummary(raw: string): { summary: string; points: string[] } {
  const jsonSlice = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    const parsed = JSON.parse(jsonSlice) as { summary?: unknown; points?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const points = Array.isArray(parsed.points)
      ? parsed.points.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean)
      : [];
    if (summary) return { summary, points };
  } catch {
    /* fall through */
  }
  // Fallback: treat the whole reply as the summary so the user still gets value.
  return { summary: raw.trim(), points: [] };
}
