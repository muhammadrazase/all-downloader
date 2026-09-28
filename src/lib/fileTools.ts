import type { Faq } from './platforms';

/** Registry for standalone file/image utility tools — same shape as pdfTools.ts and converterTools.ts. */
export type FileToolKey =
  | 'image-to-text'
  | 'text-to-image'
  | 'image-compressor'
  | 'qr-code-generator'
  | 'word-counter'
  | 'heic-to-jpg'
  | 'image-merger'
  | 'social-media-resizer'
  | 'qr-code-scanner'
  | 'video-frame-grabber';

export interface FileTool {
  key: FileToolKey;
  slug: string;
  name: string;
  keyword: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  steps: string[];
  faqs: Faq[];
}

const PRIVACY_FEATURE = { title: '100% private', body: 'Your image is processed in your browser and never uploaded — open DevTools → Network and see for yourself.' };
const FREE_FEATURE = { title: 'Free & unlimited', body: 'No signup, no watermark, no per-day limit.' };

export const FILE_TOOLS: Record<FileToolKey, FileTool> = {
  'image-to-text': {
    key: 'image-to-text',
    slug: 'image-to-text',
    name: 'Image to Text (OCR)',
    keyword: 'image to text',
    metaTitle: 'Image to Text Converter — Free OCR Online, No Upload',
    metaDescription:
      'Extract text from any image for free. Drop a photo or screenshot and get editable, copyable text in seconds — private OCR that runs in your browser, no upload.',
    h1: 'Image to text — free OCR, never uploaded',
    intro:
      'Pull the text out of a photo, screenshot or scanned document, right in your browser. Drop an image and get clean, copyable text in seconds — nothing is ever uploaded.',
    features: [
      { title: 'Batch processing', body: 'Extract text from up to 10 images at once, with per-image results.' },
      PRIVACY_FEATURE,
      { title: '7 languages', body: 'English, Spanish, French, German, Portuguese, Arabic and Urdu. Picked the wrong one? Switch it and re-extract — no need to re-upload.' },
      { title: 'Copy, .txt or .pdf', body: 'Copy each result, download all as .txt, or export a single result as a clean text PDF.' },
    ],
    steps: [
      'Drop one or more photos, screenshots or scans into the box above.',
      'Pick a language and rotate any image that\'s sideways.',
      'Click “Extract text”.',
      'Copy each result, or download it as .txt or .pdf.',
    ],
    faqs: [
      { q: 'Is my image uploaded to a server?', a: 'No. Text recognition runs entirely in your browser using WebAssembly — your images never leave your device. You can verify this yourself: open DevTools → Network and extract text with Wi-Fi off.' },
      { q: 'What image formats are supported?', a: 'PNG, JPEG, WebP and BMP.' },
      { q: 'What languages does it recognize?', a: 'English, Spanish, French, German, Portuguese, Arabic and Urdu. Pick one before extracting — and if a result comes back garbled because the wrong language was selected, just change it and hit “Re-extract”; your images stay loaded. Arabic and Urdu results display right-to-left automatically.' },
      { q: 'Can I process multiple images at once?', a: 'Yes — drop up to 10 images and extract text from all of them in one pass, each with its own copy/download.' },
      { q: 'Does it work on handwriting?', a: 'It is built for printed text (documents, screenshots, signs, receipts). Handwriting recognition is much less reliable and not the focus of this tool.' },
      { q: 'Can I export Arabic or Urdu text as a PDF?', a: 'Copy or .txt download both work for every language. .pdf export currently supports Latin-script languages only (English, Spanish, French, German, Portuguese) — exporting Arabic or Urdu to PDF shows a clear message rather than a garbled file; copy the text or use .txt instead.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'text-to-image': {
    key: 'text-to-image',
    slug: 'text-to-image',
    name: 'Text to Image',
    keyword: 'text to image',
    metaTitle: 'Text to Image Converter — Turn Text into a PNG, Free',
    metaDescription:
      'Turn any text into a downloadable PNG image, instantly. Choose colors and size, then export — no AI, no upload, runs entirely in your browser.',
    h1: 'Text to image — instant, no AI',
    intro:
      'Turn plain text into a downloadable image, right in your browser. Pick your colors and size, then export a clean PNG — great for quotes, code snippets, and social posts. No AI, nothing uploaded.',
    features: [
      { title: 'Instant rendering', body: 'Your text is drawn onto an image immediately as you type — no waiting, no AI generation.' },
      PRIVACY_FEATURE,
      { title: 'Fonts, presets & transparency', body: 'Sans, serif or monospace; alignment; padding; social-size presets that shrink the text to fit exactly; transparent PNG background.' },
      FREE_FEATURE,
    ],
    steps: [
      'Type or paste your text into the box above.',
      'Pick a font, alignment, colors and a size preset.',
      'Preview updates instantly.',
      'Click “Download” to save as PNG or JPEG.',
    ],
    faqs: [
      { q: 'Does this use AI to generate an image?', a: 'No. This tool draws your exact text onto an image using your browser\'s canvas — it does not generate pictures from a description. If you want AI-generated images, this isn\'t that kind of tool.' },
      { q: 'Is my text uploaded anywhere?', a: 'No — the image is created entirely in your browser and never sent to a server.' },
      { q: 'What sizes are available?', a: 'A "fit text" auto-size, plus ready-made presets for a square post (1080×1080), a portrait post (1080×1350), landscape (1200×675) and a story (1080×1920). Fixed-size presets shrink the text to fit so you get those exact pixel dimensions, and the real output size is always shown under the preview.' },
      { q: 'What format is the download?', a: 'PNG or JPEG, whichever you choose.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'image-compressor': {
    key: 'image-compressor',
    slug: 'image-compressor',
    name: 'Image Compressor',
    keyword: 'image compressor',
    metaTitle: 'Image Compressor Online Free — Reduce Photo Size, No Upload',
    metaDescription:
      'Compress any image to a smaller file size for free, right in your browser. Adjust quality, preview the result, and download — nothing is ever uploaded.',
    h1: 'Compress an image — free, and never uploaded',
    intro:
      'Shrink a photo\'s file size without uploading it anywhere. Adjust the quality, see the before/after size, and download the compressed result — all in your browser.',
    features: [
      { title: 'Batch compression', body: 'Compress up to 10 images at once, each with its own before/after size.' },
      PRIVACY_FEATURE,
      { title: 'JPEG, WebP or PNG', body: 'Choose lossy JPEG/WebP for the smallest file, or lossless PNG.' },
      { title: 'Target a file size', body: 'Ask for “under 200 KB” and it finds the best quality that fits — or set the quality yourself. Resize to a max width or exact dimensions too.' },
    ],
    steps: [
      'Drop one or more photos into the box above.',
      'Set a quality level or a target file size, then pick a format and resize option.',
      'Click “Compress” and compare the before/after size for each.',
      'Download each result individually.',
    ],
    faqs: [
      { q: 'Is my photo uploaded to a server?', a: 'No. Compression runs entirely in your browser using the Canvas API — your image never leaves your device.' },
      { q: 'What formats are supported?', a: 'PNG, JPEG, WebP and BMP as input; output is JPEG, WebP or PNG, whichever you choose. JPEG has no transparency, so if your image has transparent areas you choose the colour they become — white by default, never black.' },
      { q: 'Can I compress multiple images at once?', a: 'Yes — drop up to 10 images and compress them all with the same settings in one pass.' },
      { q: 'Will this reduce image quality?', a: 'For JPEG/WebP, yes by design — lossy compression trades some visual quality for a smaller file. PNG output stays lossless. The preview shows you the result before you download, and if a change makes no difference the tool says so instead of pretending.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'qr-code-generator': {
    key: 'qr-code-generator',
    slug: 'qr-code-generator',
    name: 'QR Code Generator',
    keyword: 'QR code generator',
    metaTitle: 'QR Code Generator — Wi-Fi, vCard, Email & More, Free',
    metaDescription:
      'Generate a QR code for a link, Wi-Fi network, contact card, email, phone or SMS — free and instant. Customize colors and size, download as PNG or SVG.',
    h1: 'QR code generator — free and instant',
    intro:
      'Turn a link, Wi-Fi network, contact card, email, phone number or SMS into a QR code, right in your browser. Customize the colors and size, then download as PNG or SVG — nothing is ever sent to a server.',
    features: [
      { title: '8 QR types', body: 'URL/text, Wi-Fi, email, phone, SMS, contact (vCard), calendar event and location — each built to the correct standard format.' },
      PRIVACY_FEATURE,
      { title: 'PNG or SVG', body: 'Download a raster PNG (up to 1024px, transparent background optional) or a crisp, infinitely scalable SVG.' },
      FREE_FEATURE,
    ],
    steps: [
      'Choose a type: URL/text, Wi-Fi, email, phone, SMS, contact card, calendar event or location.',
      'Fill in the details.',
      'Adjust the colors, size, transparency and error correction if you like.',
      'Click “Download PNG” or “Download SVG” to save it.',
    ],
    faqs: [
      { q: 'Is my information sent to a server?', a: 'No — the QR code is generated entirely in your browser, including Wi-Fi passwords and contact details.' },
      { q: 'Does the QR code expire?', a: 'No. It directly encodes whatever you enter — there\'s no tracking or redirect service involved, so it never expires or breaks.' },
      { q: 'Can I make a QR code that connects to Wi-Fi?', a: 'Yes — choose the Wi-Fi type, enter the network name and password (and tick “Hidden network” if it does not broadcast), and most phone cameras will offer to join the network when they scan it.' },
      { q: 'What\'s the maximum amount of text?', a: 'Roughly 2,000-2,900 characters depending on the error-correction level — a clear message appears if your content is too long.' },
      { q: 'Will my QR code actually scan?', a: 'It is built to the ISO/IEC 18004 spec with a full four-module quiet zone, and the tool warns you if your colour choices are too low-contrast or inverted — the two things that most often produce a QR code that looks fine on screen but no phone can read.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, unlimited use.' },
    ],
  },
  'word-counter': {
    key: 'word-counter',
    slug: 'word-counter',
    name: 'Word Counter',
    keyword: 'word counter',
    metaTitle: 'Word Counter — Count Words, Characters & Reading Time Free',
    metaDescription:
      'Free word and character counter with reading time, speaking time, keyword density and a readability score. Updates instantly as you type — nothing is uploaded.',
    h1: 'Word counter — instant, and never uploaded',
    intro:
      'Count words, characters, sentences and paragraphs as you type. See reading time, speaking time, keyword density and a readability score — all computed instantly in your browser.',
    features: [
      { title: 'Instant, live counts', body: 'Every stat updates as you type — no button to click.' },
      PRIVACY_FEATURE,
      { title: 'Readability score', body: 'Flesch Reading Ease and Flesch-Kincaid grade level, so you know how easy your text is to read.' },
      { title: 'Keyword density', body: 'See your most-used words and how often they appear.' },
    ],
    steps: [
      'Paste or type your text into the box above.',
      'Watch the word, character, sentence and paragraph counts update live.',
      'Check the reading time, readability score and top keywords below.',
    ],
    faqs: [
      { q: 'Is my text uploaded anywhere?', a: 'No — every count is computed entirely in your browser and never sent to a server.' },
      { q: 'How is reading time calculated?', a: 'Based on an average reading speed of about 225 words per minute; speaking time uses about 140 words per minute. Both are estimates.' },
      { q: 'What is the readability score?', a: 'The Flesch Reading Ease score (0-100, higher is easier to read) and the Flesch-Kincaid Grade Level (roughly the US school grade needed to understand the text) — two widely used, standard readability formulas.' },
      { q: 'How accurate is the syllable count behind the readability score?', a: 'It uses a well-established syllable-estimation library and is very accurate for common English words, though English pronunciation has enough exceptions that no automated syllable counter is 100% perfect.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, unlimited use.' },
    ],
  },
  'heic-to-jpg': {
    key: 'heic-to-jpg',
    slug: 'heic-to-jpg',
    name: 'HEIC to JPG',
    keyword: 'HEIC to JPG',
    metaTitle: 'HEIC to JPG Converter — Convert iPhone Photos Free, No Upload',
    metaDescription:
      'Convert HEIC/HEIF iPhone photos to JPG or PNG for free. Drop your photos and download images every device and website can open — nothing is ever uploaded.',
    h1: 'HEIC to JPG — convert iPhone photos, free',
    intro:
      'Turn HEIC or HEIF photos from an iPhone into JPG or PNG, right in your browser. Drop your photos and download images that open everywhere — nothing is ever uploaded.',
    features: [
      { title: 'Batch conversion', body: 'Convert up to 10 photos at once, each with its own result.' },
      { title: '100% private', body: 'Your photos are processed in your browser and never uploaded — open DevTools → Network and see for yourself.' },
      { title: 'JPG or PNG', body: 'Choose compressed JPG for the smallest files, or lossless PNG.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark, no per-day limit.' },
    ],
    steps: [
      'Drop one or more HEIC/HEIF photos into the box above.',
      'Choose JPG or PNG, and a quality if using JPG.',
      'Click “Convert”.',
      'Download each result.',
    ],
    faqs: [
      { q: 'Is my photo uploaded to a server?', a: 'No. Conversion runs entirely in your browser using WebAssembly — your photos never leave your device.' },
      { q: 'What is a HEIC file?', a: 'HEIC (or HEIF) is the photo format iPhones use by default since iOS 11. It’s efficient, but many apps, websites and Windows/Android devices can’t open it directly — that’s what this tool fixes.' },
      { q: 'Can I convert multiple photos at once?', a: 'Yes — drop up to 10 photos and convert them all in one pass, each with its own download.' },
      { q: 'JPG or PNG — which should I choose?', a: 'JPG for the smallest file size (adjustable quality) — the right choice for almost all photos. PNG is lossless but much larger; use it only if you specifically need that.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'image-merger': {
    key: 'image-merger',
    slug: 'image-merger',
    name: 'Image Merger',
    keyword: 'merge images',
    metaTitle: 'Image Merger — Combine Photos Into One, Free Online',
    metaDescription:
      'Merge multiple photos into one image for free — side by side, stacked, or a grid. Drag to reorder, pick a layout, and download — all in your browser, no upload.',
    h1: 'Merge images into one — free, and never uploaded',
    intro:
      'Combine two or more photos into a single image, right in your browser. Choose a layout — side by side, stacked, or a grid — reorder them, and download the result. Great for before/after shots, comparisons and social posts. Nothing is ever uploaded.',
    features: [
      { title: '3 layouts', body: 'Side by side, stacked, or an automatic grid — pick what fits your images.' },
      { title: '100% private', body: 'Your images are combined in your browser and never uploaded — open DevTools → Network and see for yourself.' },
      { title: 'Reorder & customize', body: 'Move images left/right, adjust the gap, background color and output format.' },
      { title: 'Free & unlimited', body: 'No signup, no watermark, no per-day limit.' },
    ],
    steps: [
      'Drop 2 to 10 photos into the box above.',
      'Reorder them and choose a layout: side by side, stacked, or grid.',
      'Adjust the gap, background color and format.',
      'Click “Merge” and download the combined image.',
    ],
    faqs: [
      { q: 'Are my images uploaded to a server?', a: 'No. Merging runs entirely in your browser using the Canvas API — your images never leave your device.' },
      { q: 'How many images can I merge?', a: 'Between 2 and 10 images per merge.' },
      { q: 'What if my images are different sizes?', a: 'Side by side and stacked layouts automatically match them to a common height or width. Grid layout fits each image inside an equal-sized cell without cropping, filling any gap with your chosen background color.' },
      { q: 'Can I change the order of the images?', a: 'Yes — use the arrow buttons under each thumbnail to move it earlier or later before merging.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'social-media-resizer': {
    key: 'social-media-resizer',
    slug: 'social-media-resizer',
    name: 'Social Media Resizer',
    keyword: 'resize image for social media',
    metaTitle: 'Social Media Image Resizer — Instagram, YouTube, X & More, Free',
    metaDescription:
      'Resize one photo to every social media size at once — Instagram post/story, YouTube thumbnail, X header, Facebook cover and more. Free, in your browser, no upload.',
    h1: 'Resize an image for every social platform at once',
    intro:
      'Turn one photo into the exact pixel sizes every platform expects — Instagram post and story, YouTube thumbnail, X/Twitter post and header, Facebook, LinkedIn and Pinterest. Pick as many sizes as you need and export them all in one pass, right in your browser.',
    features: [
      { title: '11 ready-made sizes', body: 'The current published dimensions for Instagram, YouTube, X, Facebook, LinkedIn and Pinterest.' },
      { title: 'One photo, every size', body: 'Select multiple sizes and get all the resized versions from a single upload.' },
      { title: '100% private', body: 'Your photo is resized in your browser and never uploaded.' },
      { title: 'Fill or fit', body: 'Crop to fill the frame with no borders, or fit the whole photo with a border color of your choice.' },
    ],
    steps: [
      'Drop your photo into the box above.',
      'Check the sizes you need — Instagram, YouTube, X, Facebook, LinkedIn, Pinterest.',
      'Choose “Fill & crop” or “Fit whole image”, and a format.',
      'Click “Resize” and download each result.',
    ],
    faqs: [
      { q: 'Is my photo uploaded to a server?', a: 'No. Resizing runs entirely in your browser using the Canvas API — your photo never leaves your device.' },
      { q: 'What\'s the difference between "Fill & crop" and "Fit whole image"?', a: '"Fill & crop" scales your photo to completely fill the target size, cropping any excess — no borders, but the edges may be trimmed. "Fit whole image" shows the entire photo with no cropping, adding a border color in any leftover space.' },
      { q: 'Can I export multiple sizes from one photo?', a: 'Yes — check as many sizes as you like and they all export together from a single upload.' },
      { q: 'Are the sizes up to date?', a: 'They reflect each platform\'s current recommended dimensions as of publishing. Platforms occasionally adjust these, so double-check for pixel-perfect requirements on high-stakes campaigns.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, unlimited use.' },
    ],
  },
  'qr-code-scanner': {
    key: 'qr-code-scanner',
    slug: 'qr-code-scanner',
    name: 'QR Code Scanner',
    keyword: 'QR code scanner',
    metaTitle: 'QR Code Scanner — Scan or Upload a QR Code Online, Free',
    metaDescription:
      'Scan a QR code with your camera or upload an image to decode it instantly. Free, private, and works in any browser — no app install needed.',
    h1: 'QR code scanner — free and instant',
    intro:
      'Decode any QR code right in your browser — point your camera at it, or upload a photo or screenshot. Get the link, text, or contact details instantly. No app to install, nothing sent to a server.',
    features: [
      { title: 'Camera or upload', body: 'Scan live with your camera, or decode a QR code from an existing photo or screenshot.' },
      { title: '100% private', body: 'Decoding runs entirely in your browser — your camera feed and images never leave your device.' },
      { title: 'Instant results', body: 'The decoded text appears immediately, with a one-tap “Open link” if it\'s a URL.' },
      { title: 'Free & unlimited', body: 'No signup, no app install, no limits.' },
    ],
    steps: [
      'Choose “Use camera” or “Upload image”.',
      'Point your camera at the QR code, or select a photo containing one.',
      'The decoded content appears automatically.',
      'Copy the text, or tap “Open link” if it\'s a URL.',
    ],
    faqs: [
      { q: 'Is my camera feed or image sent to a server?', a: 'No — decoding runs entirely in your browser. Nothing is uploaded, whether you use the camera or upload an image.' },
      { q: 'Do I need to install an app?', a: 'No — it works directly in your mobile or desktop browser.' },
      { q: 'What if my browser doesn\'t support camera access?', a: 'The “Upload image” option always works — take a photo of the QR code with your regular camera app, then upload it here.' },
      { q: 'What kinds of QR codes can it read?', a: 'Any standard QR code — links, plain text, Wi-Fi credentials, contact cards and more. The raw decoded text is always shown; a direct “Open link” button appears for web links.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, unlimited use.' },
    ],
  },
  'video-frame-grabber': {
    key: 'video-frame-grabber',
    slug: 'video-frame-grabber',
    name: 'Video Frame Grabber',
    keyword: 'extract frame from video',
    metaTitle: 'Video Frame Grabber — Extract a Screenshot from Any Video, Free',
    metaDescription:
      'Grab a still frame from any video file for free. Scrub to the exact moment, capture it as a PNG or JPG, and download — all in your browser, no upload.',
    h1: 'Grab a frame from any video — free, and never uploaded',
    intro:
      'Pull an exact still frame out of any video file, right in your browser. Play, pause or scrub to the moment you want, capture it, and download it as an image — no re-uploading needed to grab several. Nothing is ever sent to a server.',
    features: [
      { title: 'Frame-accurate capture', body: 'Scrub to the exact moment using the video\'s own play controls, then capture that frame.' },
      { title: 'Capture multiple frames', body: 'Grab as many stills as you like from one upload without starting over.' },
      { title: '100% private', body: 'Your video is processed in your browser and never uploaded.' },
      { title: 'PNG, JPEG or WebP', body: 'Choose lossless PNG, or a smaller JPEG/WebP file.' },
    ],
    steps: [
      'Drop your video file into the box above.',
      'Play, pause or scrub to the exact moment you want.',
      'Choose a format and click “Capture this frame”.',
      'Download the image, or scrub to another moment and capture again.',
    ],
    faqs: [
      { q: 'Is my video uploaded to a server?', a: 'No. Capturing runs entirely in your browser using the Canvas API — your video never leaves your device.' },
      { q: 'How is this different from the YouTube/TikTok thumbnail downloader tools?', a: 'Those tools fetch a platform\'s existing cover image from a video link. This tool works on a video FILE you already have, and lets you grab any exact moment — not just the cover.' },
      { q: 'Can I grab more than one frame?', a: 'Yes — after capturing, scrub to a different moment and capture again. Every capture stays in a gallery until you remove it.' },
      { q: 'What resolution is the captured image?', a: 'The same resolution as the video itself — nothing is upscaled or downscaled.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'What’s the maximum file size?', a: 'Up to 500 MB — larger than the converter tools, since no re-encoding happens here.' },
    ],
  },
};

export const FILE_TOOL_LIST: FileTool[] = Object.values(FILE_TOOLS);
