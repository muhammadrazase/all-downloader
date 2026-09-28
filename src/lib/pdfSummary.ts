/** Pure text logic for the PDF summarizer: budgeting a document into the payload limit, and parsing the reply back out. */

/** Matches `api/ai/pdf-summary`'s Zod bounds so the UI never sends a request the route will reject. */
export const MIN_SUMMARY_CHARS = 200;
export const MAX_SUMMARY_CHARS = 60_000;

const OMISSION_MARKER = '\n\n[…middle of the document omitted…]\n\n';

// The opening of a document carries more orienting context than its tail, but the
// tail is where conclusions live — so keep both, weighted toward the front.
const HEAD_SHARE = 0.6;

export interface BudgetedText {
  text: string;
  /** True when the middle was dropped — the UI must say so rather than imply a complete summary. */
  truncated: boolean;
}

/** Keeps the opening and closing of an overlong document — head-only truncation silently dropped the conclusion. */
export function budgetDocumentText(text: string, maxChars: number = MAX_SUMMARY_CHARS): BudgetedText {
  if (text.length <= maxChars) return { text, truncated: false };
  const keep = maxChars - OMISSION_MARKER.length;
  if (keep <= 0) return { text: text.slice(0, maxChars), truncated: true };
  const head = Math.ceil(keep * HEAD_SHARE);
  const tail = keep - head;
  return { text: `${text.slice(0, head)}${OMISSION_MARKER}${tail > 0 ? text.slice(text.length - tail) : ''}`, truncated: true };
}

export interface ParsedSummary {
  overview: string;
  keyPoints: string[];
}

/** Splits the reply into overview + key points; a model that drifts from the expected headings degrades to a plain overview, never an error. */
export function parseSummary(reply: string): ParsedSummary {
  const normalized = reply.trim();
  const headingIndex = normalized.search(/^[^\S\n]*key[^\S\n]*points[^\S\n]*:?[^\S\n]*$/im);
  const head = (headingIndex === -1 ? normalized : normalized.slice(0, headingIndex))
    .replace(/^[^\S\n]*summary[^\S\n]*:[^\S\n]*/i, '')
    .trim();
  const body = headingIndex === -1 ? '' : normalized.slice(headingIndex).replace(/^[^\S\n]*key[^\S\n]*points[^\S\n]*:?[^\S\n]*\n?/im, '');
  const keyPoints = body
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  return { overview: head, keyPoints };
}

/** The whole summary as plain text, for the copy button — same order the UI shows it in. */
export function summaryToPlainText({ overview, keyPoints }: ParsedSummary): string {
  const lines = overview ? [overview] : [];
  if (keyPoints.length) lines.push('', 'Key points:', ...keyPoints.map((point) => `- ${point}`));
  return lines.join('\n');
}
