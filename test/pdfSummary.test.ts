import { describe, it, expect } from 'vitest';
import {
  MAX_SUMMARY_CHARS,
  budgetDocumentText,
  parseSummary,
  summaryToPlainText,
} from '@/lib/pdfSummary';

describe('budgetDocumentText', () => {
  it('leaves a document that already fits completely untouched', () => {
    const text = 'A short report about nothing in particular.';
    expect(budgetDocumentText(text, 1000)).toEqual({ text, truncated: false });
  });

  it('leaves a document exactly at the limit untouched', () => {
    const text = 'x'.repeat(500);
    expect(budgetDocumentText(text, 500)).toEqual({ text, truncated: false });
  });

  // Regression: a 40-page text PDF is ~150k characters. Sent unbudgeted it exceeded
  // the summary route's 60k ceiling and came back as a raw validation error — the
  // tool simply did not work on the document lengths its own FAQ advertises.
  it('brings an over-long document under the limit and flags it as partial', () => {
    const result = budgetDocumentText('y'.repeat(150_000), MAX_SUMMARY_CHARS);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
  });

  it('keeps the end of the document, not just the beginning', () => {
    const body = 'M'.repeat(5_000);
    const result = budgetDocumentText(`OPENING_MARKER${body}CLOSING_MARKER`, 200);
    expect(result.text.startsWith('OPENING_MARKER')).toBe(true);
    expect(result.text.endsWith('CLOSING_MARKER')).toBe(true);
    expect(result.text).toContain('omitted');
  });

  it('never returns more than the limit even when the limit is tiny', () => {
    for (const limit of [1, 10, 41, 60]) {
      expect(budgetDocumentText('z'.repeat(10_000), limit).text.length).toBeLessThanOrEqual(limit);
    }
  });
});

describe('parseSummary', () => {
  const reply = [
    'Summary: Northwind Logistics grew revenue 11 percent while margin slipped.',
    'Key points:',
    '- Revenue was 4.2 million dollars.',
    '- Gross margin fell to 31 percent.',
    '- On-time delivery held at 96.4 percent.',
  ].join('\n');

  it('splits the prompt-specified format into an overview and key points', () => {
    const parsed = parseSummary(reply);
    expect(parsed.overview).toBe('Northwind Logistics grew revenue 11 percent while margin slipped.');
    expect(parsed.keyPoints).toEqual([
      'Revenue was 4.2 million dollars.',
      'Gross margin fell to 31 percent.',
      'On-time delivery held at 96.4 percent.',
    ]);
  });

  it('strips the literal "Summary:" label instead of showing it to the reader', () => {
    expect(parseSummary('Summary: It is about widgets.').overview).toBe('It is about widgets.');
  });

  it('accepts the bullet characters and numbering a model actually emits', () => {
    const parsed = parseSummary('Summary: x\nKey Points\n* first\n• second\n1. third\n2) fourth');
    expect(parsed.keyPoints).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('degrades to showing the whole reply rather than losing it when the format drifts', () => {
    const freeform = 'This document covers procurement variance across three suppliers.';
    expect(parseSummary(freeform)).toEqual({ overview: freeform, keyPoints: [] });
  });

  it('does not mistake the phrase "key points" inside a sentence for the heading', () => {
    const parsed = parseSummary('Summary: The report lists key points about pricing and then stops.');
    expect(parsed.keyPoints).toEqual([]);
    expect(parsed.overview).toContain('key points about pricing');
  });

  it('handles an empty reply without throwing', () => {
    expect(parseSummary('')).toEqual({ overview: '', keyPoints: [] });
  });
});

describe('summaryToPlainText', () => {
  it('round-trips a parsed summary back into copyable text', () => {
    const parsed = { overview: 'An overview.', keyPoints: ['One.', 'Two.'] };
    expect(summaryToPlainText(parsed)).toBe('An overview.\n\nKey points:\n- One.\n- Two.');
  });

  it('omits the key-points heading when there are none', () => {
    expect(summaryToPlainText({ overview: 'Just an overview.', keyPoints: [] })).toBe('Just an overview.');
  });
});
