import type { Faq } from './platforms';
import type { ConvertKind } from './convert';

export type ConverterKey =
  | 'video-to-mp3'
  | 'video-to-gif'
  | 'video-converter'
  | 'video-trimmer'
  | 'video-compressor'
  | 'audio-trimmer'
  | 'video-watermark'
  | 'video-speed-changer'
  | 'video-merger';

export interface ConverterTool {
  key: ConverterKey;
  slug: string;
  name: string;
  keyword: string;
  /** Omitted for tools (like the Trimmer) whose UI isn't a kind-picker — ConverterToolPage renders `children` instead. */
  kinds?: ConvertKind[];
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
  'video-trimmer': {
    key: 'video-trimmer',
    slug: 'video-trimmer',
    name: 'Video Trimmer',
    keyword: 'trim video',
    metaTitle: 'Video Trimmer — Cut a Clip from Any Video, Free',
    metaDescription:
      'Trim a video to just the part you need, free and private. Set a start and end time and download the clip — all in your browser, no upload, no watermark.',
    h1: 'Video Trimmer',
    intro:
      'Cut a video down to just the part you want, right in your browser. Set a start and end time, preview the result, and download the clip — nothing is ever uploaded.',
    features: [
      { title: 'Frame-accurate trim', body: 'Set the exact start and end second, down to a tenth of a second.' },
      { title: '100% private', body: 'Your video is trimmed in your browser and never uploaded.' },
      { title: 'Trim multiple parts', body: 'Pull several clips out of one upload without re-uploading it each time.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark, no file limit per day.' },
    ],
    steps: [
      'Drop your video file into the box above.',
      'Set a start and end time — or use “Set to current time” while it plays.',
      'Press “Trim video”.',
      'Preview and download the trimmed clip.',
    ],
    faqs: [
      { q: 'How do I trim a video?', a: 'Drop the video into the box, set a start and end time, and press Trim — the clip is cut out entirely in your browser, then you download it.' },
      { q: 'Is my video uploaded anywhere?', a: 'No. Trimming runs locally in your browser using WebAssembly, so your file never leaves your device.' },
      { q: 'Can I pull out more than one clip from the same video?', a: 'Yes — after a trim finishes, adjust the start and end time and trim again without re-uploading the video.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'What’s the maximum file size?', a: 'Up to 200 MB. For longer videos, a smaller source file trims faster.' },
    ],
  },
  'video-compressor': {
    key: 'video-compressor',
    slug: 'video-compressor',
    name: 'Video Compressor',
    keyword: 'video compressor',
    metaTitle: 'Video Compressor — Shrink Video File Size Online, Free',
    metaDescription:
      'Compress a video to a smaller file size for free, right in your browser. Pick a quality level, keep it playable everywhere, and download — no upload, no signup, no watermark.',
    h1: 'Video Compressor',
    intro:
      'Shrink a video\'s file size without uploading it anywhere. Pick a quality level, compress in your browser, and compare the before/after size — nothing ever leaves your device.',
    features: [
      { title: '3 quality presets', body: 'Best quality, balanced, or smallest file — pick what matters more for this clip.' },
      { title: '100% private', body: 'Your video is compressed in your browser and never uploaded.' },
      { title: 'Plays everywhere', body: 'Output is a standard H.264 MP4 that opens on any device or platform.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark, no file limit per day.' },
    ],
    steps: [
      'Drop your video file into the box above.',
      'Choose a quality level: Best quality, Balanced, or Smallest file.',
      'Press “Compress video”.',
      'Compare the before/after size and download the result.',
    ],
    faqs: [
      { q: 'How much smaller will my video be?', a: 'It depends on the source, but the Balanced preset typically cuts file size by 50-80% with little visible quality loss. Already-compressed videos shrink less.' },
      { q: 'Is my video uploaded anywhere?', a: 'No. Compression runs locally in your browser using WebAssembly, so your file never leaves your device.' },
      { q: 'Will this reduce video quality?', a: 'Yes, by design — video compression trades some quality for a smaller file. “Best quality” keeps it nearly identical; “Smallest file” trades more quality for maximum size reduction.' },
      { q: 'Does it also resize the video?', a: 'Videos wider than 1920px are automatically scaled down, since that alone significantly reduces file size — anything 1920px or narrower keeps its original resolution.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'What’s the maximum file size?', a: 'Up to 200 MB per file.' },
    ],
  },
  'audio-trimmer': {
    key: 'audio-trimmer',
    slug: 'audio-trimmer',
    name: 'Audio Trimmer',
    keyword: 'trim audio',
    metaTitle: 'Audio Trimmer — Cut an MP3 or Audio Clip Online, Free',
    metaDescription:
      'Trim an MP3, WAV or other audio file to just the part you need, free and private. Set a start and end time and download the clip — all in your browser, no upload.',
    h1: 'Audio Trimmer',
    intro:
      'Cut an audio file down to just the part you want, right in your browser. Set a start and end time, preview the result, and download the clip — nothing is ever uploaded.',
    features: [
      { title: 'Frame-accurate trim', body: 'Set the exact start and end second, down to a tenth of a second.' },
      { title: '100% private', body: 'Your audio is trimmed in your browser and never uploaded.' },
      { title: 'Trim multiple parts', body: 'Pull several clips out of one upload without re-uploading it each time.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark, no file limit per day.' },
    ],
    steps: [
      'Drop your audio file into the box above.',
      'Set a start and end time — or use “Set to current time” while it plays.',
      'Press “Trim audio”.',
      'Preview and download the trimmed clip as an MP3.',
    ],
    faqs: [
      { q: 'How do I trim an MP3?', a: 'Drop the file into the box, set a start and end time, and press Trim — the clip is cut out entirely in your browser, then you download it as an MP3.' },
      { q: 'What audio formats are supported?', a: 'MP3, WAV, M4A, OGG, AAC and FLAC as input — the trimmed result always downloads as an MP3.' },
      { q: 'Is my file uploaded anywhere?', a: 'No. Trimming runs locally in your browser using WebAssembly, so your file never leaves your device.' },
      { q: 'Can I pull out more than one clip?', a: 'Yes — after a trim finishes, adjust the start and end time and trim again without re-uploading the file.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'What’s the maximum file size?', a: 'Up to 200 MB.' },
    ],
  },
  'video-watermark': {
    key: 'video-watermark',
    slug: 'video-watermark',
    name: 'Video Watermark',
    keyword: 'add watermark to video',
    metaTitle: 'Add Watermark to Video Online — Free Logo Overlay, No Upload',
    metaDescription:
      'Add your logo as a watermark to any video for free. Pick the position, size and opacity, then download — all in your browser, no upload, no signup.',
    h1: 'Add a Watermark to Your Video',
    intro:
      'Brand your videos with your own logo, right in your browser. Upload a video and a logo image, choose the position, size and opacity, and download the result — nothing is ever uploaded.',
    features: [
      { title: '5 positions', body: 'Top-left, top-right, center, bottom-left or bottom-right corner placement.' },
      { title: 'Adjustable size & opacity', body: 'Small, medium or large logo, with opacity from subtle to fully solid.' },
      { title: '100% private', body: 'Your video and logo are processed in your browser and never uploaded.' },
      { title: 'Free & unlimited', body: 'No signup, no extra watermark added by us, no file limit per day.' },
    ],
    steps: [
      'Drop your video file into the box above.',
      'Choose a logo image — a PNG with a transparent background works best.',
      'Pick a position, size and opacity.',
      'Press “Add watermark”, then preview and download the result.',
    ],
    faqs: [
      { q: 'What image formats work as a watermark?', a: 'PNG, JPEG, WebP or BMP, up to 10 MB. A PNG with a transparent background gives the cleanest result — a JPEG watermark shows as a solid rectangle.' },
      { q: 'Is my video uploaded anywhere?', a: 'No. Everything runs locally in your browser using WebAssembly — your video and logo never leave your device.' },
      { q: 'Can I control how see-through the logo is?', a: 'Yes — the opacity slider goes from 10% (very subtle) to 100% (fully solid).' },
      { q: 'Does this add a SnapVidly watermark to my video?', a: 'No — this tool only adds the logo you upload. The output has no branding from us.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no limits.' },
      { q: 'What’s the maximum file size?', a: 'Up to 200 MB for the video.' },
    ],
  },
  'video-speed-changer': {
    key: 'video-speed-changer',
    slug: 'video-speed-changer',
    name: 'Video Speed Changer',
    keyword: 'change video speed',
    metaTitle: 'Video Speed Changer — Slow Motion & Fast Forward, Free',
    metaDescription:
      'Speed up or slow down a video for free, right in your browser. From 0.25x slow motion to 4x fast-forward, with natural-sounding audio — no upload, no signup, no watermark.',
    h1: 'Video Speed Changer',
    intro:
      'Slow a video down for a smooth slow-motion effect, or speed it up for a fast-forward or time-lapse look — right in your browser. The audio speeds up or slows down with it, pitch-corrected so it never sounds like a chipmunk or a growl. Nothing is ever uploaded.',
    features: [
      { title: '8 speed presets', body: 'From 0.25x slow motion to 4x fast-forward.' },
      { title: 'Pitch-corrected audio', body: 'The soundtrack speeds up or slows down naturally, without the classic chipmunk effect.' },
      { title: '100% private', body: 'Your video is processed in your browser and never uploaded.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark, no file limit per day.' },
    ],
    steps: [
      'Drop your video file into the box above.',
      'Pick a speed: 0.25x through 4x.',
      'Press “Change speed”.',
      'Preview and download the result.',
    ],
    faqs: [
      { q: 'Will the audio sound weird if I slow down or speed up the video?', a: 'No — the pitch is corrected automatically, so a slowed-down voice still sounds natural instead of a low growl, and a sped-up one doesn\'t sound like a chipmunk.' },
      { q: 'Is my video uploaded anywhere?', a: 'No. Processing runs locally in your browser using WebAssembly, so your file never leaves your device.' },
      { q: 'What if my video has no sound?', a: 'It works the same way — the video speed still changes, there\'s just no audio to adjust.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'What’s the maximum file size?', a: 'Up to 200 MB.' },
    ],
  },
  'video-merger': {
    key: 'video-merger',
    slug: 'video-merger',
    name: 'Video Merger',
    keyword: 'merge videos',
    metaTitle: 'Video Merger — Combine Multiple Videos Into One, Free',
    metaDescription:
      'Merge up to 5 video clips into one, in the order you choose — free and private, right in your browser. Handles different resolutions and formats. No upload, no signup.',
    h1: 'Merge videos into one — free, and never uploaded',
    intro:
      'Combine 2 to 5 video clips into a single video, in whatever order you choose — right in your browser. Clips of different resolutions or formats are automatically matched to fit together cleanly. Kept deliberately limited in size and count, since merging video is far more demanding on your device\'s memory than a single conversion. Nothing is ever uploaded.',
    features: [
      { title: 'Any mix of resolutions', body: 'Clips are automatically scaled and matched to fit together, even from different phones or platforms.' },
      { title: 'Reorder before merging', body: 'Arrange your clips in exactly the order you want them to play.' },
      { title: '100% private', body: 'Your videos are combined in your browser and never uploaded.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark — limited only by the size caps below, to keep it running smoothly.' },
    ],
    steps: [
      'Drop 2 to 5 video clips into the box above.',
      'Reorder them using the arrow buttons if needed.',
      'Press “Merge”.',
      'Preview and download the combined video.',
    ],
    faqs: [
      { q: 'How many videos can I merge, and how large can they be?', a: 'Up to 5 videos per merge, each under 100 MB, with a combined total under 300 MB. These limits are deliberately tighter than the other tools — merging holds every clip in memory at once, which is far more demanding than converting one file.' },
      { q: 'Can I merge videos with different resolutions?', a: 'Yes — every clip is automatically scaled and centered (letterboxed) to match the first video\'s resolution, so mismatched clips still combine cleanly instead of failing.' },
      { q: 'What happens to the audio?', a: 'If every clip has an audio track, they\'re combined in sync with the video. If even one clip is silent, the merged video has no audio at all — a consistent, predictable result rather than guessing which clips should get silence.' },
      { q: 'Is my video uploaded anywhere?', a: 'No. Merging runs entirely in your browser using WebAssembly — your files never leave your device.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
};

export const CONVERTER_LIST: ConverterTool[] = Object.values(CONVERTER_TOOLS);
