'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import {
  countWords,
  countCharacters,
  countSentences,
  countParagraphs,
  estimateReadingTimeMinutes,
  estimateSpeakingTimeMinutes,
  countSyllables,
  fleschReadingEase,
  fleschKincaidGrade,
  fleschReadingEaseLabel,
  topKeywords,
} from '@/lib/textStats';

function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  const whole = Math.floor(minutes);
  const secs = Math.round((minutes - whole) * 60);
  return secs > 0 ? `${whole} min ${secs} sec` : `${whole} min`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

export function WordCounterBox() {
  const [text, setText] = useState('');
  // Cheap O(n) counts use the immediate value; expensive derived stats (syllables,
  // keyword density) use the deferred value to protect the INP budget on long pastes.
  const deferredText = useDeferredValue(text);

  const words = useMemo(() => countWords(text), [text]);
  const characters = useMemo(() => countCharacters(text), [text]);
  const charactersNoSpaces = useMemo(() => countCharacters(text, { excludeSpaces: true }), [text]);
  const sentences = useMemo(() => countSentences(text), [text]);
  const paragraphs = useMemo(() => countParagraphs(text), [text]);
  const readingTime = useMemo(() => estimateReadingTimeMinutes(words), [words]);
  const speakingTime = useMemo(() => estimateSpeakingTimeMinutes(words), [words]);

  const readability = useMemo(() => {
    const deferredWords = countWords(deferredText);
    const deferredSentences = countSentences(deferredText);
    if (deferredWords === 0) return null;
    const wordList = deferredText.toLowerCase().match(/[a-z']+/g) ?? [];
    const syllables = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
    const input = { words: deferredWords, sentences: deferredSentences, syllables };
    return {
      ease: fleschReadingEase(input),
      grade: fleschKincaidGrade(input),
    };
  }, [deferredText]);

  const keywords = useMemo(() => topKeywords(deferredText, { topN: 10 }), [deferredText]);

  return (
    <div className="w-full">
      <label htmlFor="word-counter-text" className="sr-only">Text to analyze</label>
      <textarea
        id="word-counter-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your text here…"
        rows={10}
        className="w-full resize-y rounded-lg border border-surface-border bg-surface p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Words" value={words} />
        <StatCard label="Characters" value={characters} />
        <StatCard label="Characters (no spaces)" value={charactersNoSpaces} />
        <StatCard label="Sentences" value={sentences} />
        <StatCard label="Paragraphs" value={paragraphs} />
        <StatCard label="Reading time" value={formatMinutes(readingTime)} />
        <StatCard label="Speaking time" value={formatMinutes(speakingTime)} />
        {readability && <StatCard label="Grade level" value={readability.grade.toFixed(1)} />}
      </div>

      {readability && (
        <div className="card mt-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Readability</h2>
            <span className="text-sm font-medium text-accent">{fleschReadingEaseLabel(readability.ease)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Flesch Reading Ease: {readability.ease.toFixed(1)} · Flesch-Kincaid grade level: {readability.grade.toFixed(1)}
          </p>
        </div>
      )}

      {keywords.length > 0 && (
        <div className="card mt-4 p-4">
          <h2 className="text-sm font-semibold text-ink">Top keywords</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {keywords.map((k) => (
              <li key={k.word} className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
                {k.word} <span className="text-ink-faint">· {k.count} ({k.density.toFixed(1)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Nothing is uploaded — every count updates instantly in your browser.</p>
    </div>
  );
}
