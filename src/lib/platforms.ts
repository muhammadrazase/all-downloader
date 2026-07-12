/**
 * Platform registry — drives the 5 tool pages, nav, sitemap, schema and the engine.
 * Every platform has UNIQUE copy (titles, descriptions, FAQs). Duplicate/templated
 * content is a ranking killer, so each field is written per-platform on purpose.
 */

export type PlatformKey =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'facebook'
  | 'linkedin'
  | 'twitter'
  | 'pinterest'
  | 'reddit'
  | 'vimeo'
  | 'twitch'
  | 'tumblr';

export interface Faq {
  q: string;
  a: string;
}

export interface Platform {
  key: PlatformKey;
  name: string;
  slug: string; // exact-match SEO slug at site root
  keyword: string; // primary target keyword
  brandColor: string; // used sparingly as a per-platform dot, not the whole theme
  /** URL host patterns accepted by the engine (SSRF whitelist source of truth). */
  hostPattern: RegExp;
  urlExample: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  mobileSteps: string[];
  pcSteps: string[];
  faqs: Faq[];
}

export const PLATFORMS: Record<PlatformKey, Platform> = {
  tiktok: {
    key: 'tiktok',
    name: 'TikTok',
    slug: 'tiktok-downloader',
    keyword: 'TikTok video downloader',
    brandColor: '#000000',
    hostPattern: /^https?:\/\/([\w-]+\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\//i,
    urlExample: 'https://www.tiktok.com/@username/video/1234567890',
    metaTitle: 'TikTok Video Downloader — Save TikToks Without Watermark (HD)',
    metaDescription:
      'Download TikTok videos without watermark in HD. Free TikTok downloader for mobile and PC — paste the link, tap download. No app, no signup.',
    h1: 'TikTok Video Downloader — No Watermark, HD',
    intro:
      'Save any public TikTok in seconds. Paste a video link and download it in full HD without the TikTok watermark — perfect for reposting, editing, or keeping your own clips. Works right in your browser on phone and desktop.',
    features: [
      { title: 'No watermark', body: 'Get the clean video without the TikTok logo or username stamp.' },
      { title: 'HD quality', body: 'Download in the highest resolution TikTok serves — up to 1080p.' },
      { title: 'MP3 audio', body: 'Grab the sound or original song from any TikTok as an audio file.' },
      { title: 'No app needed', body: 'Everything runs in the browser. Nothing to install, no account.' },
    ],
    mobileSteps: [
      'Open TikTok and tap Share on the video, then Copy link.',
      'Come back here and paste the link into the box above.',
      'Tap Download and choose “No watermark HD”.',
      'The video saves straight to your camera roll or Files.',
    ],
    pcSteps: [
      'Open the TikTok video in your browser and copy the URL from the address bar.',
      'Paste it into the download box above and press Download.',
      'Pick your quality (HD MP4 or MP3 audio).',
      'The file downloads directly from TikTok’s servers to your computer.',
    ],
    faqs: [
      { q: 'Can I download TikToks without the watermark?', a: 'Yes. SnapVidly fetches the clean source file, so your download has no TikTok watermark or username overlay.' },
      { q: 'Is the TikTok downloader free?', a: 'Completely free with no signup, no app, and no limit on how many videos you save.' },
      { q: 'Can I save just the audio or the original sound?', a: 'Yes — choose the MP3 option to download the sound from any TikTok video.' },
      { q: 'Does it work on iPhone and Android?', a: 'It works in any mobile browser. On iPhone, downloads save to Files or Photos; on Android, to your Downloads folder.' },
    ],
  },
  instagram: {
    key: 'instagram',
    name: 'Instagram',
    slug: 'instagram-video-downloader',
    keyword: 'Instagram video downloader',
    brandColor: '#E1306C',
    hostPattern: /^https?:\/\/([\w-]+\.)?instagram\.com\//i,
    urlExample: 'https://www.instagram.com/reel/AbCdEfGhIjK/',
    metaTitle: 'Instagram Video Downloader — Save Reels & Videos in HD (Free)',
    metaDescription:
      'Download Instagram Reels, videos and IGTV in HD. Free Instagram video downloader for mobile and PC — paste the link and save. No login, no watermark.',
    h1: 'Instagram Video Downloader — Reels & Videos in HD',
    intro:
      'Download Instagram Reels and video posts in high quality without a login. Paste any public Reel or video link and save it to your phone or computer in one tap — ideal for keeping inspiration, sharing, or re-editing.',
    features: [
      { title: 'Reels & videos', body: 'Save Reels, feed videos and IGTV from any public account.' },
      { title: 'Full HD', body: 'Download the original resolution Instagram serves, not a compressed copy.' },
      { title: 'No login', body: 'No need to connect your Instagram account or share credentials.' },
      { title: 'Thumbnail preview', body: 'See the video before you download so you grab the right clip.' },
    ],
    mobileSteps: [
      'Open the Reel or video in the Instagram app and tap the three dots.',
      'Tap “Copy link”.',
      'Paste the link into the box above and tap Download.',
      'Choose your quality and the video saves to your device.',
    ],
    pcSteps: [
      'Open the Instagram Reel or video in your browser and copy the URL.',
      'Paste it above and press Download.',
      'Select HD MP4 (or audio only).',
      'The file downloads directly to your PC.',
    ],
    faqs: [
      { q: 'Can I download Instagram Reels on my phone?', a: 'Yes. Copy the Reel link from the app, paste it here, and download in HD — no extra app required.' },
      { q: 'Do I need to log into Instagram?', a: 'No. SnapVidly only works with public posts and never asks for your Instagram login.' },
      { q: 'Why can’t I download a private video?', a: 'Private accounts are not accessible. Only public Reels, videos and IGTV can be downloaded.' },
      { q: 'Does it keep the original quality?', a: 'Yes — SnapVidly fetches the source file so you get the same resolution Instagram serves.' },
    ],
  },
  youtube: {
    key: 'youtube',
    name: 'YouTube',
    slug: 'youtube-video-downloader',
    keyword: 'YouTube video downloader',
    brandColor: '#FF0000',
    hostPattern: /^https?:\/\/([\w-]+\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i,
    urlExample: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    metaTitle: 'YouTube Video Downloader — Save Videos in HD, 4K & MP3 (Free)',
    metaDescription:
      'Download YouTube videos in HD, 4K or MP3 for free. Fast YouTube downloader for mobile and PC — paste a link and choose your format. No signup.',
    h1: 'YouTube Video Downloader — HD, 4K & MP3',
    intro:
      'Download YouTube videos in the quality you want — from 720p and 1080p all the way to 4K, or extract MP3 audio. Paste a YouTube link, pick a format, and save it to your device. Fast, free, and browser-based.',
    features: [
      { title: 'Up to 4K', body: 'Choose 720p, 1080p, 1440p or 4K depending on the source video.' },
      { title: 'MP3 extraction', body: 'Save music, podcasts or talks as an audio-only MP3 file.' },
      { title: 'Pick your format', body: 'Clear, plain-language quality buttons — no confusing codec labels.' },
      { title: 'No signup', body: 'No account, no email, no software to install.' },
    ],
    mobileSteps: [
      'Open the video in the YouTube app and tap Share, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and choose your resolution or MP3.',
      'The file saves to your device.',
    ],
    pcSteps: [
      'Copy the YouTube URL from the address bar or the Share menu.',
      'Paste it above and press Download.',
      'Select HD, 4K or MP3.',
      'The video downloads to your computer.',
    ],
    faqs: [
      { q: 'Can I download YouTube videos in 4K?', a: 'Yes, when the original video is available in 4K you can select it. Otherwise you’ll get the highest resolution the source provides.' },
      { q: 'How do I convert a YouTube video to MP3?', a: 'Paste the link, then choose the “Audio · MP3” option to download just the sound.' },
      { q: 'Is downloading YouTube videos free?', a: 'Yes, SnapVidly is free. Please only download content you own or have permission to use — see our disclaimer.' },
      { q: 'Does it work on mobile?', a: 'Yes. Copy the link from the YouTube app and download directly in your mobile browser.' },
    ],
  },
  facebook: {
    key: 'facebook',
    name: 'Facebook',
    slug: 'facebook-video-downloader',
    keyword: 'Facebook video downloader',
    brandColor: '#1877F2',
    hostPattern: /^https?:\/\/([\w-]+\.)?(facebook\.com|fb\.watch|fb\.com)\//i,
    urlExample: 'https://www.facebook.com/watch/?v=1234567890',
    metaTitle: 'Facebook Video Downloader — Save FB Videos in HD & SD (Free)',
    metaDescription:
      'Download Facebook videos in HD or SD for free. Facebook video downloader for mobile and PC — paste the link and save Watch, Reels and feed videos. No login.',
    h1: 'Facebook Video Downloader — HD & SD',
    intro:
      'Save public Facebook videos, Reels and Watch clips in HD or SD. Paste the video link and download it straight to your phone or computer — no login and no Facebook app required.',
    features: [
      { title: 'HD or SD', body: 'Choose high-definition or a smaller SD file to save data.' },
      { title: 'Watch & Reels', body: 'Works with feed videos, Facebook Watch and Facebook Reels.' },
      { title: 'No login', body: 'Only public videos — we never ask for your Facebook credentials.' },
      { title: 'Direct download', body: 'The file comes straight from Facebook’s CDN, so it’s fast.' },
    ],
    mobileSteps: [
      'Open the video in the Facebook app, tap Share, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and pick HD or SD.',
      'The video saves to your device.',
    ],
    pcSteps: [
      'Right-click the Facebook video and copy the video URL, or copy it from the address bar.',
      'Paste it above and press Download.',
      'Choose HD or SD MP4.',
      'The file downloads to your PC.',
    ],
    faqs: [
      { q: 'Can I download Facebook videos in HD?', a: 'Yes. When an HD version exists you can pick it; otherwise SD is available as a smaller file.' },
      { q: 'Do I need to be logged in?', a: 'No. SnapVidly downloads public Facebook videos without any login.' },
      { q: 'Can I download Facebook Reels?', a: 'Yes — paste the Reel link the same way you would any Facebook video.' },
      { q: 'Why won’t a private video download?', a: 'Videos from private profiles or groups aren’t publicly accessible and can’t be downloaded.' },
    ],
  },
  linkedin: {
    key: 'linkedin',
    name: 'LinkedIn',
    slug: 'linkedin-video-downloader',
    keyword: 'LinkedIn video downloader',
    brandColor: '#0A66C2',
    hostPattern: /^https?:\/\/([\w-]+\.)?linkedin\.com\//i,
    urlExample: 'https://www.linkedin.com/posts/username_activity-1234567890',
    metaTitle: 'LinkedIn Video Downloader — Save LinkedIn Videos in HD (Free)',
    metaDescription:
      'Download LinkedIn videos in HD for free. LinkedIn video downloader for mobile and PC — paste the post link and save native videos. No login, no watermark.',
    h1: 'LinkedIn Video Downloader — Native Videos in HD',
    intro:
      'Download native LinkedIn videos from public posts in high quality. Paste the post link and save the video to your device — useful for saving talks, product demos, and professional content for offline reference.',
    features: [
      { title: 'Native videos', body: 'Grab videos uploaded directly to LinkedIn posts in HD.' },
      { title: 'For professionals', body: 'Save talks, demos and case studies to reference offline.' },
      { title: 'No login', body: 'Works with public posts — no LinkedIn account required.' },
      { title: 'Clean file', body: 'Download the source MP4 with no overlay or watermark.' },
    ],
    mobileSteps: [
      'Open the LinkedIn post, tap the three dots, then “Copy link to post”.',
      'Paste the link into the box above.',
      'Tap Download and choose your quality.',
      'The video saves to your device.',
    ],
    pcSteps: [
      'Open the LinkedIn post and copy the post URL from your browser.',
      'Paste it above and press Download.',
      'Select HD MP4.',
      'The file downloads to your computer.',
    ],
    faqs: [
      { q: 'Can I download native LinkedIn videos?', a: 'Yes. SnapVidly saves videos uploaded directly to public LinkedIn posts in HD.' },
      { q: 'Does it work with shared or external videos?', a: 'It works with native LinkedIn uploads. Videos embedded from other sites should be downloaded from their original platform.' },
      { q: 'Do I need a LinkedIn account?', a: 'No. Public posts can be downloaded without logging in.' },
      { q: 'Is there a watermark?', a: 'No. You get the clean source MP4 with no watermark or overlay.' },
    ],
  },
  twitter: {
    key: 'twitter',
    name: 'Twitter / X',
    slug: 'twitter-video-downloader',
    keyword: 'Twitter video downloader',
    brandColor: '#000000',
    hostPattern: /^https?:\/\/([\w-]+\.)?(twitter\.com|x\.com|t\.co)\//i,
    urlExample: 'https://x.com/username/status/1234567890',
    metaTitle: 'Twitter Video Downloader — Save X (Twitter) Videos in HD Free',
    metaDescription:
      'Download Twitter / X videos and GIFs in HD for free. Paste a tweet link and save the video to your phone or PC — no app, no signup, no watermark.',
    h1: 'Twitter / X Video Downloader — HD & GIF',
    intro:
      'Save videos and GIFs from Twitter (X) in high quality. Paste the link to any public tweet and download the clip straight to your device — great for keeping viral moments, GIFs and clips. Works on mobile and desktop.',
    features: [
      { title: 'Videos & GIFs', body: 'Download both native X videos and animated GIFs from any public tweet.' },
      { title: 'HD quality', body: 'Grab the highest resolution the tweet was uploaded in.' },
      { title: 'No login', body: 'Works with public tweets — no X account or password needed.' },
      { title: 'Fast & free', body: 'Direct download from X’s servers, no app to install.' },
    ],
    mobileSteps: [
      'Open the tweet in the X app, tap Share, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and choose your quality.',
      'The video saves to your device.',
    ],
    pcSteps: [
      'Copy the tweet URL from your browser’s address bar.',
      'Paste it above and press Download.',
      'Select the quality you want.',
      'The file downloads to your computer.',
    ],
    faqs: [
      { q: 'Can I download videos from X (Twitter)?', a: 'Yes. Paste any public tweet link containing a video or GIF and download it in HD — no login required.' },
      { q: 'Can I save Twitter GIFs?', a: 'Yes. X serves GIFs as short videos, and SnapVidly saves them as an MP4 you can share anywhere.' },
      { q: 'Do I need the X app?', a: 'No. Everything runs in your browser on phone or computer.' },
      { q: 'Why won’t a private tweet download?', a: 'Only public tweets are accessible. Protected/private accounts can’t be downloaded.' },
    ],
  },
  pinterest: {
    key: 'pinterest',
    name: 'Pinterest',
    slug: 'pinterest-video-downloader',
    keyword: 'Pinterest video downloader',
    brandColor: '#E60023',
    hostPattern: /^https?:\/\/([\w-]+\.)?(pinterest\.[\w.]+|pin\.it)\//i,
    urlExample: 'https://www.pinterest.com/pin/1234567890/',
    metaTitle: 'Pinterest Video Downloader — Save Pinterest Videos & Pins Free',
    metaDescription:
      'Download Pinterest videos and story pins in HD for free. Paste a pin link and save the video to your phone or PC — no app, no signup, no watermark.',
    h1: 'Pinterest Video Downloader — HD Pins',
    intro:
      'Save videos and idea pins from Pinterest in high quality. Paste any public pin link and download the clip to your device — perfect for saving recipes, DIY, tutorials and inspiration to watch offline. Mobile and desktop friendly.',
    features: [
      { title: 'Video pins', body: 'Download standard video pins and idea/story pins in full quality.' },
      { title: 'HD output', body: 'Save the original resolution Pinterest serves.' },
      { title: 'No account', body: 'No Pinterest login needed for public pins.' },
      { title: 'Any device', body: 'Runs in any browser — phone, tablet or computer.' },
    ],
    mobileSteps: [
      'Open the pin in the Pinterest app, tap the three dots, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and pick your quality.',
      'The video saves to your device.',
    ],
    pcSteps: [
      'Open the pin in your browser and copy the URL.',
      'Paste it above and press Download.',
      'Choose your quality.',
      'The file downloads to your PC.',
    ],
    faqs: [
      { q: 'Can I download Pinterest videos?', a: 'Yes. Copy the pin link and paste it here to save the video in HD — no watermark, no signup.' },
      { q: 'Does it work with idea pins / story pins?', a: 'Yes, public video and idea pins can be downloaded the same way.' },
      { q: 'Do I need the Pinterest app?', a: 'No. It works in any mobile or desktop browser.' },
      { q: 'Can I download images too?', a: 'This tool focuses on videos. Image pins can be saved directly from Pinterest with a long-press or right-click.' },
    ],
  },
  reddit: {
    key: 'reddit',
    name: 'Reddit',
    slug: 'reddit-video-downloader',
    keyword: 'Reddit video downloader',
    brandColor: '#FF4500',
    hostPattern: /^https?:\/\/([\w-]+\.)?(reddit\.com|redd\.it|v\.redd\.it)\//i,
    urlExample: 'https://www.reddit.com/r/videos/comments/abc123/title/',
    metaTitle: 'Reddit Video Downloader — Save Reddit Videos With Sound (Free)',
    metaDescription:
      'Download Reddit videos with sound in HD for free. Paste a Reddit post link and save the video — audio included — to your phone or PC. No app, no signup.',
    h1: 'Reddit Video Downloader — With Sound, HD',
    intro:
      'Save Reddit videos with audio in one step. Reddit stores video and sound separately, so SnapVidly merges them for you and delivers a single HD MP4 — no more silent downloads. Paste any public Reddit post link. Works on mobile and PC.',
    features: [
      { title: 'Sound included', body: 'We merge Reddit’s separate video and audio into one file — with sound.' },
      { title: 'HD quality', body: 'Download the highest resolution available on the post.' },
      { title: 'v.redd.it support', body: 'Works with reddit.com posts and v.redd.it / redd.it links.' },
      { title: 'No login', body: 'Public posts only — no Reddit account required.' },
    ],
    mobileSteps: [
      'Open the post in the Reddit app, tap Share, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and choose your quality.',
      'The video saves with sound to your device.',
    ],
    pcSteps: [
      'Copy the Reddit post URL from your browser.',
      'Paste it above and press Download.',
      'Select your quality.',
      'The merged video (with audio) downloads to your PC.',
    ],
    faqs: [
      { q: 'Why do Reddit videos download without sound elsewhere?', a: 'Reddit stores video and audio as separate streams. SnapVidly merges them, so your download always includes sound.' },
      { q: 'Does it work with v.redd.it links?', a: 'Yes. Paste the reddit.com post link or the v.redd.it / redd.it link — both work.' },
      { q: 'Do I need a Reddit account?', a: 'No. Public posts can be downloaded without logging in.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  vimeo: {
    key: 'vimeo',
    name: 'Vimeo',
    slug: 'vimeo-video-downloader',
    keyword: 'Vimeo downloader',
    brandColor: '#1AB7EA',
    hostPattern: /^https?:\/\/([\w-]+\.)?vimeo\.com\//i,
    urlExample: 'https://vimeo.com/123456789',
    metaTitle: 'Vimeo Downloader — Download Vimeo Videos in HD Free',
    metaDescription:
      'Download Vimeo videos in HD for free. Paste a Vimeo link and save the video to your phone or PC — no app, no signup. For content you own or have rights to.',
    h1: 'Vimeo Video Downloader — HD',
    intro:
      'Download public Vimeo videos in high quality for offline viewing. Paste a Vimeo link, pick your resolution, and save the file to your device. Ideal for saving talks, films and creative work you have the rights to. Works on mobile and desktop.',
    features: [
      { title: 'Up to HD', body: 'Choose the resolution Vimeo offers for the video.' },
      { title: 'MP3 audio', body: 'Extract audio only when you just want the sound.' },
      { title: 'No signup', body: 'No account, no software — it runs in the browser.' },
      { title: 'Clean file', body: 'Download the source video with no overlay.' },
    ],
    mobileSteps: [
      'Open the Vimeo video and tap Share, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and choose your quality.',
      'The video saves to your device.',
    ],
    pcSteps: [
      'Copy the Vimeo URL from your browser.',
      'Paste it above and press Download.',
      'Select HD or MP3.',
      'The file downloads to your PC.',
    ],
    faqs: [
      { q: 'Can I download any Vimeo video?', a: 'You can download public Vimeo videos. Please only download content you own or have permission to use — see our disclaimer.' },
      { q: 'Can I get just the audio?', a: 'Yes — choose the MP3 option to save the sound only.' },
      { q: 'Why won’t a private video download?', a: 'Password-protected or private Vimeo videos aren’t publicly accessible and can’t be downloaded.' },
      { q: 'Is it free?', a: 'Yes, completely free with no signup.' },
    ],
  },
  twitch: {
    key: 'twitch',
    name: 'Twitch',
    slug: 'twitch-clip-downloader',
    keyword: 'Twitch clip downloader',
    brandColor: '#9146FF',
    hostPattern: /^https?:\/\/([\w-]+\.)?(twitch\.tv|clips\.twitch\.tv)\//i,
    urlExample: 'https://clips.twitch.tv/AbcClipName',
    metaTitle: 'Twitch Clip Downloader — Save Twitch Clips & VODs in HD (Free)',
    metaDescription:
      'Download Twitch clips and VODs in HD for free. Paste a Twitch clip or video link and save it to your phone or PC — no app, no signup, no watermark.',
    h1: 'Twitch Clip Downloader — Clips & VODs',
    intro:
      'Save Twitch clips and VODs in high quality. Paste a clip or video link and download the stream highlight to your device — perfect for keeping your best moments or making montages. Works on mobile and desktop.',
    features: [
      { title: 'Clips & VODs', body: 'Download Twitch clips and past broadcasts (VODs) in HD.' },
      { title: 'HD quality', body: 'Grab the highest resolution the clip provides.' },
      { title: 'No login', body: 'Works with public clips — no Twitch account needed.' },
      { title: 'For creators', body: 'Great for montages, highlights and re-sharing your own clips.' },
    ],
    mobileSteps: [
      'Open the clip in Twitch, tap Share, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and choose your quality.',
      'The clip saves to your device.',
    ],
    pcSteps: [
      'Copy the Twitch clip or VOD URL from your browser.',
      'Paste it above and press Download.',
      'Select your quality.',
      'The file downloads to your PC.',
    ],
    faqs: [
      { q: 'Can I download Twitch clips?', a: 'Yes. Paste a clips.twitch.tv or twitch.tv clip link and save it in HD — free, no watermark.' },
      { q: 'Can I download full VODs?', a: 'Public VODs can be downloaded, though long broadcasts take longer to process.' },
      { q: 'Do I need a Twitch account?', a: 'No. Public clips and VODs can be downloaded without logging in.' },
      { q: 'Is it free?', a: 'Yes — free with no signup.' },
    ],
  },
  tumblr: {
    key: 'tumblr',
    name: 'Tumblr',
    slug: 'tumblr-video-downloader',
    keyword: 'Tumblr video downloader',
    brandColor: '#36465D',
    hostPattern: /^https?:\/\/([\w-]+\.)?tumblr\.com\//i,
    urlExample: 'https://www.tumblr.com/blog/view/username/1234567890',
    metaTitle: 'Tumblr Video Downloader — Save Tumblr Videos in HD (Free)',
    metaDescription:
      'Download Tumblr videos in HD for free. Paste a Tumblr post link and save the video to your phone or PC — no app, no signup, no watermark.',
    h1: 'Tumblr Video Downloader — HD',
    intro:
      'Save videos from Tumblr in high quality. Paste any public Tumblr post link and download the clip to your device in one tap — great for keeping the posts you love. Works on mobile and desktop.',
    features: [
      { title: 'HD videos', body: 'Download Tumblr video posts in the best available quality.' },
      { title: 'No account', body: 'Works with public posts — no Tumblr login needed.' },
      { title: 'MP3 option', body: 'Save the audio only when you just want the sound.' },
      { title: 'Any device', body: 'Runs in any mobile or desktop browser.' },
    ],
    mobileSteps: [
      'Open the Tumblr post, tap the share icon, then Copy link.',
      'Paste the link into the box above.',
      'Tap Download and choose your quality.',
      'The video saves to your device.',
    ],
    pcSteps: [
      'Copy the Tumblr post URL from your browser.',
      'Paste it above and press Download.',
      'Select HD or MP3.',
      'The file downloads to your PC.',
    ],
    faqs: [
      { q: 'Can I download Tumblr videos?', a: 'Yes. Copy the post link and paste it here to save the video in HD — no watermark, no signup.' },
      { q: 'Do I need a Tumblr account?', a: 'No. Public posts can be downloaded without logging in.' },
      { q: 'Can I save just the audio?', a: 'Yes — choose the MP3 option to download the sound only.' },
      { q: 'Is it free?', a: 'Yes, completely free.' },
    ],
  },
};

export const PLATFORM_LIST: Platform[] = Object.values(PLATFORMS);

export const getPlatformBySlug = (slug: string): Platform | undefined =>
  PLATFORM_LIST.find((p) => p.slug === slug);

export const getPlatformByKey = (key: string): Platform | undefined =>
  (PLATFORMS as Record<string, Platform>)[key];

/** Detect platform from a pasted URL — powers the universal home box (no dropdown). */
export const detectPlatform = (url: string): Platform | undefined =>
  PLATFORM_LIST.find((p) => p.hostPattern.test(url.trim()));
