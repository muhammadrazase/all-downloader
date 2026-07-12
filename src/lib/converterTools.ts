import type { Faq } from './platforms';
import type { ConvertKind } from './convert';

export type ConverterKey = 'video-to-mp3' | 'video-to-gif' | 'video-converter';

export interface ConverterTool {
  key: ConverterKey;
  slug: string;
  name: string;
  keyword: string;
  kinds: ConvertKind[];
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  steps: string[];
  faqs: Faq[];
}

const PRIVACY_FEATURE = { title: '100% private', body: 'Your file is converted in your browser and never uploaded.' };
const FREE_FEATURE = { title: 'Free & unlimited', body: 'No signup, no watermark, no file limit per day.' };

export const CONVERTER_TOOLS: Record<ConverterKey, ConverterTool> = {
  'video-to-mp3': {
    key: 'video-to-mp3',
    slug: 'video-to-mp3',
    name: 'Video to MP3',
    keyword: 'video to MP3',
    kinds: ['mp3'],
    metaTitle: 'Video to MP3 Converter — Convert Video to MP3 Online Free',
    metaDescription:
      'Convert any video to MP3 online, free. Drop an MP4/MOV/WebM and extract the audio in your browser — private, no upload, no signup, no watermark.',
    h1: 'Video to MP3 Converter',
    intro:
      'Turn any video into an MP3 audio file, right in your browser. Drop an MP4, MOV or WebM and get clean 192 kbps audio in seconds — nothing is uploaded, so it’s completely private and free.',
    features: [
      { title: '192 kbps MP3', body: 'Clear audio extracted from your video.' },
      PRIVACY_FEATURE,
      { title: 'Any video format', body: 'MP4, MOV, WebM, MKV, AVI and more.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop your video file into the box above (or click to choose).',
      'Press “Convert to MP3 audio”.',
      'Wait a moment while it converts in your browser.',
      'Play the result and download your MP3.',
    ],
    faqs: [
      { q: 'How do I convert a video to MP3?', a: 'Drop the video into the box and press Convert — the audio is extracted to MP3 entirely in your browser, then you download it.' },
      { q: 'Is my file uploaded anywhere?', a: 'No. Conversion runs locally in your browser using WebAssembly, so your file never leaves your device.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'What’s the maximum file size?', a: 'Up to 200 MB. For long videos, trim first or use a smaller clip.' },
    ],
  },
  'video-to-gif': {
    key: 'video-to-gif',
    slug: 'video-to-gif',
    name: 'Video to GIF',
    keyword: 'video to GIF',
    kinds: ['gif'],
    metaTitle: 'Video to GIF Converter — Make a GIF from a Video (Free)',
    metaDescription:
      'Convert any video to an animated GIF online, free. Drop an MP4/MOV and make a shareable GIF in your browser — private, no upload, no signup, no watermark.',
    h1: 'Video to GIF Converter',
    intro:
      'Make a shareable animated GIF from any video, right in your browser. Drop an MP4 or MOV and get a smooth, optimized GIF — nothing is uploaded, so it’s private and free.',
    features: [
      { title: 'Smooth GIFs', body: 'Optimized 12 fps output that looks great anywhere.' },
      PRIVACY_FEATURE,
      { title: 'Any video format', body: 'MP4, MOV, WebM, MKV and more.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop your video file into the box above.',
      'Press “Convert to Animated GIF”.',
      'Wait while it converts in your browser.',
      'Preview and download your GIF.',
    ],
    faqs: [
      { q: 'How do I make a GIF from a video?', a: 'Drop the video into the box and press Convert — it’s turned into an animated GIF in your browser, then you download it.' },
      { q: 'Does the GIF have a watermark?', a: 'No. The GIF is clean, with no watermark or overlay.' },
      { q: 'Is my video uploaded?', a: 'No — everything happens locally in your browser. Your file stays on your device.' },
      { q: 'Any size limit?', a: 'Up to 200 MB. Short clips make the best GIFs.' },
    ],
  },
  'video-converter': {
    key: 'video-converter',
    slug: 'video-converter',
    name: 'Video Converter',
    keyword: 'online video converter',
    kinds: ['mp3', 'gif', '720', '480'],
    metaTitle: 'Free Online Video Converter — MP3, GIF, Resize (No Upload)',
    metaDescription:
      'Free online video converter. Convert video to MP3, GIF, or resize to 720p/480p — all in your browser, private, no upload, no signup, no watermark.',
    h1: 'Free Online Video Converter',
    intro:
      'Convert your videos without uploading anything. Turn a video into MP3 audio or an animated GIF, or shrink it to 720p/480p — all in your browser, private and free.',
    features: [
      { title: 'MP3 · GIF · resize', body: 'Multiple outputs from one clean tool.' },
      PRIVACY_FEATURE,
      { title: 'Any input format', body: 'MP4, MOV, WebM, MKV, AVI and more.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop your video into the box above.',
      'Choose an output: MP3, GIF, 720p or 480p.',
      'Press Convert and wait a moment.',
      'Preview and download the result.',
    ],
    faqs: [
      { q: 'What can I convert?', a: 'Video → MP3 audio, video → animated GIF, or downscale a video to 720p/480p — all in your browser.' },
      { q: 'Is anything uploaded to a server?', a: 'No. It uses WebAssembly to convert locally, so your file never leaves your device.' },
      { q: 'Is it really free?', a: 'Yes — free, unlimited, no signup, no watermark.' },
      { q: 'Max file size?', a: 'Up to 200 MB per file.' },
    ],
  },
};

export const CONVERTER_LIST: ConverterTool[] = Object.values(CONVERTER_TOOLS);
