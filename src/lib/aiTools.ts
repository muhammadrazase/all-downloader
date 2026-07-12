import type { Faq } from './platforms';

/** Registry for the AI tool pages — one entry per page, drives copy + SEO + schema. */

export type AiToolKey = 'video-to-text' | 'video-summary';
export type AiToolType = 'transcript' | 'summary';

export interface AiTool {
  key: AiToolKey;
  slug: AiToolKey;
  toolType: AiToolType;
  name: string;
  metaTitle: string;
  metaDescription: string;
  keyword: string;
  keywords: string[];
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  steps: string[];
  faqs: Faq[];
  /** Related how-to post — two-way internal link for topical authority. */
  relatedPost: { title: string; href: string };
}

export const AI_TOOLS: Record<AiToolKey, AiTool> = {
  'video-to-text': {
    key: 'video-to-text',
    slug: 'video-to-text',
    toolType: 'transcript',
    name: 'Video to Text',
    metaTitle: 'Video to Text — Free AI Transcript & Subtitle Generator',
    metaDescription:
      'Turn any video into text for free. Paste a YouTube, TikTok, Instagram or X link and get an accurate transcript plus downloadable SRT/VTT subtitles. No signup.',
    keyword: 'video to text',
    keywords: [
      'video to text',
      'download video transcript',
      'get subtitles from video',
      'youtube transcript generator',
      'free subtitle generator',
      'ai transcript generator',
      'video to srt',
    ],
    h1: 'Video to text — free transcript & subtitle generator',
    intro:
      'Paste a video link and get a clean, accurate transcript in seconds — then download it as SRT or VTT subtitles, or plain text. Powered by open AI speech recognition. Free, no signup.',
    features: [
      { title: 'Accurate transcripts', body: 'State-of-the-art Whisper speech recognition handles accents, music and background noise.' },
      { title: 'SRT & VTT subtitles', body: 'Get timestamped subtitle files ready for YouTube, video editors and web players — one click each.' },
      { title: 'Translate to English', body: 'Transcribe a video in any language and get the English text automatically.' },
      { title: 'Private & free', body: 'We only read the audio to generate text — nothing is uploaded or stored. No account, no watermark.' },
    ],
    steps: [
      'Copy the link to any public video (YouTube, TikTok, Instagram, X and more).',
      'Paste it into the box above and click “Get transcript”.',
      'Wait a few seconds while the audio is transcribed.',
      'Copy the text, or download it as SRT, VTT or TXT.',
    ],
    faqs: [
      { q: 'Is the video-to-text tool free?', a: 'Yes — it is completely free with no signup, no account and no watermark.' },
      { q: 'What subtitle formats can I download?', a: 'You can download timestamped subtitles as SRT or VTT, and the full transcript as a plain TXT file.' },
      { q: 'Which languages are supported?', a: 'The speech recognition supports 90+ languages automatically. Tick “Translate to English” to get an English transcript from any language.' },
      { q: 'How long can the video be?', a: 'Videos up to about 30 minutes work best. Longer videos may be rejected to keep the tool fast and free for everyone.' },
      { q: 'Do you store my video or transcript?', a: 'No. The audio is processed to generate the text and then discarded. We do not host or store your video or its transcript.' },
      { q: 'Which sites does it work with?', a: 'Any public video from TikTok, YouTube, Instagram, Facebook, X (Twitter), Reddit, Pinterest, Vimeo, Twitch, Tumblr and LinkedIn.' },
    ],
    relatedPost: { title: 'How to get subtitles from any video', href: '/blog/youtube/how-to-get-subtitles-from-any-video' },
  },
  'video-summary': {
    key: 'video-summary',
    slug: 'video-summary',
    toolType: 'summary',
    name: 'Video Summary',
    metaTitle: 'AI Video Summary — Summarize Any Video Free',
    metaDescription:
      'Get an instant AI summary of any video. Paste a YouTube, TikTok or Instagram link and get a short overview plus the key points — free, no signup. Save time.',
    keyword: 'video summary',
    keywords: [
      'video summary',
      'summarize youtube video',
      'ai video summary',
      'youtube video summarizer',
      'summarize video with ai',
      'tiktok video summary',
    ],
    h1: 'AI video summary — get the gist in seconds',
    intro:
      'Short on time? Paste a video link and get a clear AI summary plus the key takeaways — without watching the whole thing. Works on YouTube, TikTok, Instagram and more. Free, no signup.',
    features: [
      { title: 'Instant overview', body: 'A 2–4 sentence summary of what the video is actually about, generated from its full transcript.' },
      { title: 'Key points', body: 'The main takeaways pulled out as a scannable bullet list, so you get the value in seconds.' },
      { title: 'Any platform', body: 'YouTube, TikTok, Instagram, X, Reddit and more — if we can read the audio, we can summarize it.' },
      { title: 'Private & free', body: 'No signup, no account, nothing stored. Powered by free AI models with automatic fallback so it just works.' },
    ],
    steps: [
      'Copy the link to any public video you want to understand quickly.',
      'Paste it into the box above and click “Summarize”.',
      'We transcribe the audio and an AI model reads it.',
      'Read the short overview and the key points — copy them with one click.',
    ],
    faqs: [
      { q: 'Is the AI video summary free?', a: 'Yes — it is free with no signup. It runs on free AI models with automatic provider fallback so it stays available.' },
      { q: 'How accurate is the summary?', a: 'The summary is generated from the video’s actual transcript, so it reflects what was said. Always verify critical details against the source.' },
      { q: 'Can it summarize videos in other languages?', a: 'Yes. The audio is transcribed first — including non-English speech — and then summarized.' },
      { q: 'How long can the video be?', a: 'Videos up to about 30 minutes work best. Longer videos may be rejected to keep summaries fast and free.' },
      { q: 'Do you store the video or the summary?', a: 'No. The audio is processed to produce the summary and then discarded. Nothing is hosted or stored.' },
      { q: 'Which sites are supported?', a: 'TikTok, YouTube, Instagram, Facebook, X (Twitter), Reddit, Pinterest, Vimeo, Twitch, Tumblr and LinkedIn.' },
    ],
    relatedPost: { title: 'How to summarize a YouTube video', href: '/blog/youtube/how-to-summarize-a-youtube-video' },
  },
};

export const AI_TOOL_LIST: AiTool[] = Object.values(AI_TOOLS);
