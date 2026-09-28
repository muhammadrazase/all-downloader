import { describe, it, expect } from 'vitest';
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
  STOP_WORDS,
} from '../src/lib/textStats';

describe('countWords', () => {
  it('counts space-separated words', () => expect(countWords('one two three')).toBe(3));
  it('collapses multiple spaces/newlines', () => expect(countWords('one   two\n\nthree')).toBe(3));
  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
  it('trims leading/trailing whitespace before counting', () => expect(countWords('  hello world  ')).toBe(2));
});

describe('countCharacters', () => {
  it('counts every character by default, including spaces', () => expect(countCharacters('a b')).toBe(3));
  it('excludes whitespace when asked', () => expect(countCharacters('a b\tc\nd', { excludeSpaces: true })).toBe(4));
  it('returns 0 for an empty string', () => expect(countCharacters('')).toBe(0));
});

describe('countSentences', () => {
  it('counts sentences split on . ! ?', () => expect(countSentences('Hi. Bye! Really?')).toBe(3));
  it('treats text with no terminal punctuation as one sentence', () => expect(countSentences('hello world')).toBe(1));
  it('returns 0 for empty text', () => expect(countSentences('')).toBe(0));
  it('collapses repeated punctuation ("...", "?!") into one boundary', () => expect(countSentences('Wait... really?!')).toBe(2));
});

describe('countParagraphs', () => {
  it('a single newline does not start a new paragraph', () => expect(countParagraphs('line one\nline two')).toBe(1));
  it('a blank line separates paragraphs', () => expect(countParagraphs('para one\n\npara two')).toBe(2));
  it('collapses multiple blank lines into one boundary', () => expect(countParagraphs('a\n\n\n\nb')).toBe(2));
  it('returns 0 for empty text', () => expect(countParagraphs('')).toBe(0));
});

describe('estimateReadingTimeMinutes / estimateSpeakingTimeMinutes', () => {
  it('divides words by the given rate', () => {
    expect(estimateReadingTimeMinutes(450, 225)).toBe(2);
    expect(estimateSpeakingTimeMinutes(280, 140)).toBe(2);
  });
  it('uses a sensible default rate when none is given', () => {
    expect(estimateReadingTimeMinutes(225)).toBeCloseTo(1, 5);
    expect(estimateSpeakingTimeMinutes(140)).toBeCloseTo(1, 5);
  });
});

// `syllable` (wooorm, MIT) was chosen over a hand-rolled heuristic after the hand-rolled
// version scored only 72% on this exact bank; `syllable` scored 92% on the same words.
describe('countSyllables', () => {
  const bank: Record<string, number> = {
    the: 1, cat: 1, apple: 2, table: 2, simple: 2, little: 2, bottle: 2, purple: 2, circle: 2, people: 2,
    syllable: 3, beautiful: 3, family: 3, example: 3, elephant: 3, umbrella: 3, computer: 3, wonderful: 3,
    idea: 3, banana: 3, different: 3, hour: 1, our: 1, queue: 1, create: 2, orange: 2, movement: 2,
    created: 3, chocolate: 3, single: 2, middle: 2, cycle: 2, rhythm: 2,
  };
  it.each(Object.entries(bank))('"%s" has %i syllable(s)', (word, expected) => {
    expect(countSyllables(word)).toBe(expected);
  });
  it('returns 0 for a non-word (no letters)', () => expect(countSyllables('123')).toBe(0));
  it('never returns 0 for a real word', () => expect(countSyllables('a')).toBeGreaterThanOrEqual(1));
});

// Formula correctness verified against the PUBLISHED Flesch formulas, hand-computed —
// not against the function's own output (that would be circular).
describe('fleschReadingEase / fleschKincaidGrade — formula correctness', () => {
  it('matches a hand-computed value for the published Flesch Reading Ease formula', () => {
    // 206.835 - 1.015*(100/5) - 84.6*(150/100) = 206.835 - 20.3 - 126.9 = 59.635
    expect(fleschReadingEase({ words: 100, sentences: 5, syllables: 150 })).toBeCloseTo(59.635, 3);
  });
  it('matches a hand-computed value for the published Flesch-Kincaid Grade Level formula', () => {
    // 0.39*(100/5) + 11.8*(150/100) - 15.59 = 7.8 + 17.7 - 15.59 = 9.91
    expect(fleschKincaidGrade({ words: 100, sentences: 5, syllables: 150 })).toBeCloseTo(9.91, 3);
  });
  it('returns 0 rather than NaN/Infinity when words or sentences is 0', () => {
    expect(fleschReadingEase({ words: 0, sentences: 0, syllables: 0 })).toBe(0);
    expect(fleschKincaidGrade({ words: 0, sentences: 5, syllables: 10 })).toBe(0);
  });
});

describe('fleschReadingEaseLabel', () => {
  it.each([
    [100, 'Very Easy'], [90, 'Very Easy'], [89.9, 'Easy'],
    [80, 'Easy'], [79.9, 'Fairly Easy'],
    [70, 'Fairly Easy'], [69.9, 'Standard'],
    [60, 'Standard'], [59.9, 'Fairly Difficult'],
    [50, 'Fairly Difficult'], [49.9, 'Difficult'],
    [30, 'Difficult'], [29.9, 'Very Confusing'],
    [0, 'Very Confusing'], [-20, 'Very Confusing'],
  ])('scores %s as "%s"', (score, label) => {
    expect(fleschReadingEaseLabel(score)).toBe(label);
  });
});

describe('topKeywords', () => {
  it('excludes stop words even when they are the most frequent', () => {
    const result = topKeywords('the the the cat sat on the the mat quietly');
    expect(result.some((r) => STOP_WORDS.has(r.word))).toBe(false);
    expect(result.map((r) => r.word)).toContain('quietly');
  });
  it('counts and orders by frequency, most frequent first', () => {
    const result = topKeywords('apple apple apple banana banana cherry');
    expect(result[0]).toMatchObject({ word: 'apple', count: 3 });
    expect(result[1]).toMatchObject({ word: 'banana', count: 2 });
  });
  it('computes density as a percentage of counted (non-stop) words', () => {
    const result = topKeywords('apple apple banana');
    const apple = result.find((r) => r.word === 'apple')!;
    expect(apple.density).toBeCloseTo((2 / 3) * 100, 5);
  });
  it('respects minLength, excluding short words', () => {
    const result = topKeywords('ox ox ox elephant elephant', { minLength: 4 });
    expect(result.map((r) => r.word)).not.toContain('ox');
  });
  it('respects topN', () => {
    const result = topKeywords('alpha beta gamma delta epsilon', { topN: 2 });
    expect(result).toHaveLength(2);
  });
  it('returns an empty array for text with no countable words', () => {
    expect(topKeywords('the a an is')).toEqual([]);
    expect(topKeywords('')).toEqual([]);
  });
});
