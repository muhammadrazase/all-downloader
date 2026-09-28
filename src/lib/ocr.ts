/** Client-side OCR via Tesseract.js — self-hosted SIMD+LSTM-only core (~2.7MB vs ~19MB for every variant). */

export class OcrError extends Error {
  constructor(
    message: string,
    public readonly code: 'unsupported_file' | 'too_large' | 'recognition_failed',
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

const MAX_MB = 20; // OCR memory scales with decoded pixels, not just file bytes — keep this modest

export type OcrLanguage = 'eng' | 'spa' | 'fra' | 'deu' | 'por' | 'ara' | 'urd';

export const OCR_LANGUAGES: { code: OcrLanguage; label: string }[] = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'por', label: 'Portuguese' },
  { code: 'ara', label: 'Arabic' },
  { code: 'urd', label: 'Urdu' },
];

/** Arabic and Urdu are right-to-left scripts — the UI must not force LTR on their extracted text. */
export function isRtlLanguage(lang: OcrLanguage): boolean {
  return lang === 'ara' || lang === 'urd';
}

export interface OcrResult {
  text: string;
  confidence: number; // 0-100, Tesseract's own estimate — not the same as correctness
}

/** Recognizes text in one image. Creates and terminates its own worker per call — verified this keeps memory back at baseline. */
export async function recognizeImage(file: File | Blob, lang: OcrLanguage = 'eng'): Promise<OcrResult> {
  if (file instanceof File && file.size > MAX_MB * 1024 * 1024) {
    throw new OcrError(`That image is over ${MAX_MB} MB.`, 'too_large');
  }

  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker(lang, Tesseract.OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
    langPath: '/ocr',
  });

  try {
    const { data } = await worker.recognize(file);
    const text = data.text.trim();
    if (!text) {
      throw new OcrError('No text was found in this image.', 'recognition_failed');
    }
    return { text, confidence: data.confidence };
  } catch (e) {
    if (e instanceof OcrError) throw e;
    throw new OcrError('Could not read text from this image.', 'recognition_failed');
  } finally {
    await worker.terminate();
  }
}

export function isSupportedImage(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(file.type);
}

/** Rotates an image by a multiple of 90° before recognition — helps accuracy on sideways scans/photos. */
export async function rotateImage(file: File | Blob, degrees: 90 | 180 | 270): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const swap = degrees === 90 || degrees === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new OcrError('Canvas 2D context is not available in this browser.', 'recognition_failed');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new OcrError('Could not rotate this image.', 'recognition_failed'))), 'image/png');
  });
}
