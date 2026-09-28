export class QrError extends Error {
  constructor(message: string, public readonly code: 'too_long' | 'empty' | 'render_failed') {
    super(message);
    this.name = 'QrError';
  }
}

export interface QrOptions {
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  color: string;
  background: string;
  transparentBackground: boolean;
  width: number;
}

export type QrType = 'text' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard' | 'event' | 'geo';

export interface WifiFields { ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass'; hidden: boolean }
export interface EmailFields { address: string; subject: string; body: string }
export interface PhoneFields { number: string }
export interface SmsFields { number: string; message: string }
export interface VCardFields { name: string; phone: string; email: string; org: string }
export interface EventFields { title: string; location: string; description: string; start: string; end: string } // start/end: <input type="datetime-local"> values
export interface GeoFields { lat: string; lon: string }

/** ISO/IEC 18004 requires a 4-module quiet zone; anything narrower makes real scanners fail against busy backgrounds. */
const QUIET_ZONE_MODULES = 4;

/** Escapes the reserved characters in the WIFI: QR payload spec (backslash, semicolon, comma, colon, quote). */
function escapeWifiField(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1');
}

/** Escapes a TEXT value per vCard/iCalendar's shared rules — unescaped commas/semicolons silently split fields. */
function escapeTextValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Both RFC 2426 and RFC 5545 mandate CRLF line breaks; some importers reject LF-only payloads. */
function foldCrlf(lines: string[]): string {
  return lines.join('\r\n');
}

/** Percent-encodes a mailto header value. RFC 6068 §2: "+" is a literal plus in a mailto URI, never a space. */
function encodeMailtoValue(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Converts a `datetime-local` input value ("YYYY-MM-DDTHH:MM[:SS]") to the iCalendar DATE-TIME form ("YYYYMMDDTHHMMSS"), as floating (no timezone) local time. */
function toIcsDateTime(local: string): string {
  const [datePart = '', timePart = '00:00'] = local.split('T');
  return `${datePart.replace(/-/g, '')}T${timePart.replace(/:/g, '').padEnd(6, '0')}`;
}

function toIcsUtcStamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** FNV-1a — a stable, content-derived UID keeps the payload deterministic (and unit-testable) instead of random. */
function contentHash(s: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Builds the standard encoded payload for each QR type — plain text passes through unchanged. Pure, unit-testable. */
export function buildQrPayload(
  type: QrType,
  text: string,
  fields: Partial<WifiFields & EmailFields & PhoneFields & SmsFields & VCardFields & EventFields & GeoFields>,
  now: Date = new Date(),
): string {
  switch (type) {
    case 'wifi': {
      const { ssid = '', password = '', encryption = 'WPA', hidden = false } = fields;
      const auth = encryption === 'nopass' ? 'nopass' : encryption;
      return `WIFI:T:${auth};S:${escapeWifiField(ssid)};P:${encryption === 'nopass' ? '' : escapeWifiField(password)};H:${hidden ? 'true' : 'false'};;`;
    }
    case 'email': {
      const { address = '', subject = '', body = '' } = fields;
      const params: string[] = [];
      if (subject) params.push(`subject=${encodeMailtoValue(subject)}`);
      if (body) params.push(`body=${encodeMailtoValue(body)}`);
      return `mailto:${address}${params.length ? `?${params.join('&')}` : ''}`;
    }
    case 'phone': {
      const { number = '' } = fields;
      return `tel:${number}`;
    }
    case 'sms': {
      const { number = '', message = '' } = fields;
      return `SMSTO:${number}:${message}`;
    }
    case 'vcard': {
      const { name = '', phone = '', email = '', org = '' } = fields;
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeTextValue(name)}`];
      if (org) lines.push(`ORG:${escapeTextValue(org)}`);
      if (phone) lines.push(`TEL:${escapeTextValue(phone)}`);
      if (email) lines.push(`EMAIL:${escapeTextValue(email)}`);
      lines.push('END:VCARD');
      return foldCrlf(lines);
    }
    case 'event': {
      const { title = '', location = '', description = '', start = '', end = '' } = fields;
      // PRODID, UID and DTSTAMP are REQUIRED by RFC 5545 — calendar apps reject imports without them.
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SnapVidly//QR Code Generator//EN',
        'BEGIN:VEVENT',
        `UID:${contentHash(`${title}|${start}|${end}|${location}`)}@snapvidly.com`,
        `DTSTAMP:${toIcsUtcStamp(now)}`,
        `SUMMARY:${escapeTextValue(title)}`,
      ];
      if (start) lines.push(`DTSTART:${toIcsDateTime(start)}`);
      if (end) lines.push(`DTEND:${toIcsDateTime(end)}`);
      if (location) lines.push(`LOCATION:${escapeTextValue(location)}`);
      if (description) lines.push(`DESCRIPTION:${escapeTextValue(description)}`);
      lines.push('END:VEVENT', 'END:VCALENDAR');
      return foldCrlf(lines);
    }
    case 'geo': {
      const { lat = '', lon = '' } = fields;
      return `geo:${lat},${lon}`;
    }
    case 'text':
    default:
      return text;
  }
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (start: number) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG-style contrast ratio between two #rrggbb colors — 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [first, second] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Warns about colors that produce a technically-valid QR code phone cameras still can't read: weak contrast or inversion. */
export function qrContrastWarning(color: string, background: string, transparentBackground: boolean): string | null {
  const effectiveBackground = transparentBackground ? '#ffffff' : background;
  if (relativeLuminance(color) > relativeLuminance(effectiveBackground)) {
    return 'The foreground is lighter than the background. Many phone cameras cannot read inverted QR codes — swap the colours to be safe.';
  }
  if (contrastRatio(color, effectiveBackground) < 4) {
    return 'These colours are too close together. Scanners need a strong dark-on-light contrast — pick a darker foreground or a lighter background.';
  }
  return null;
}

/** `qrcode` treats an 8-digit hex with a zero alpha as "draw nothing", which is exactly a transparent QR. */
function lightColor(opts: QrOptions): string {
  return opts.transparentBackground ? '#00000000' : opts.background;
}

/** Renders a QR code onto the given canvas. Dynamic-imports `qrcode` so it never enters the shared bundle. */
export async function renderQrCode(canvas: HTMLCanvasElement, text: string, opts: QrOptions): Promise<void> {
  if (!text.trim()) {
    throw new QrError('Enter some content to generate a QR code.', 'empty');
  }
  const QRCode = await import('qrcode');
  try {
    await QRCode.toCanvas(canvas, text, {
      errorCorrectionLevel: opts.errorCorrectionLevel,
      width: opts.width,
      margin: QUIET_ZONE_MODULES,
      color: { dark: opts.color, light: lightColor(opts) },
    });
  } catch {
    throw new QrError('That content is too long to fit in a QR code — try shortening it.', 'too_long');
  }
}

/** Renders a QR code as an SVG markup string, for a scalable vector download. */
export async function renderQrSvg(text: string, opts: QrOptions): Promise<string> {
  if (!text.trim()) {
    throw new QrError('Enter some content to generate a QR code.', 'empty');
  }
  const QRCode = await import('qrcode');
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: opts.errorCorrectionLevel,
      width: opts.width,
      margin: QUIET_ZONE_MODULES,
      color: { dark: opts.color, light: lightColor(opts) },
    });
  } catch {
    throw new QrError('That content is too long to fit in a QR code — try shortening it.', 'too_long');
  }
}
