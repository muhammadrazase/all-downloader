import { describe, it, expect } from 'vitest';
import { buildQrPayload, contrastRatio, qrContrastWarning, renderQrSvg, QrError } from '../src/lib/qr';

/** Fixed clock so the DTSTAMP an event payload is required to carry stays assertable. */
const FIXED_NOW = new Date('2026-01-02T03:04:05Z');

describe('buildQrPayload', () => {
  it('passes plain text through unchanged', () => {
    expect(buildQrPayload('text', 'https://example.com', {})).toBe('https://example.com');
  });

  it('builds a WIFI: payload with escaped reserved characters', () => {
    const payload = buildQrPayload('wifi', '', { ssid: 'Home;Net', password: 'p:a,s\\s', encryption: 'WPA', hidden: false });
    expect(payload).toBe('WIFI:T:WPA;S:Home\\;Net;P:p\\:a\\,s\\\\s;H:false;;');
  });

  it('omits the password for an open (nopass) WiFi network', () => {
    const payload = buildQrPayload('wifi', '', { ssid: 'Cafe', password: 'ignored', encryption: 'nopass', hidden: false });
    expect(payload).toBe('WIFI:T:nopass;S:Cafe;P:;H:false;;');
  });

  it('marks a hidden network so the phone still finds it', () => {
    expect(buildQrPayload('wifi', '', { ssid: 'Cafe', password: 'pw', encryption: 'WPA', hidden: true })).toContain('H:true;');
  });

  it('percent-encodes mailto spaces (RFC 6068 — "+" is a literal plus, not a space)', () => {
    const payload = buildQrPayload('email', '', { address: 'a@b.com', subject: 'Hi there', body: 'See you & bye' });
    expect(payload).toBe('mailto:a@b.com?subject=Hi%20there&body=See%20you%20%26%20bye');
    expect(payload).not.toContain('+');
  });

  it('builds a mailto: link with no query string when subject/body are empty', () => {
    expect(buildQrPayload('email', '', { address: 'a@b.com', subject: '', body: '' })).toBe('mailto:a@b.com');
  });

  it('builds a tel: link', () => {
    expect(buildQrPayload('phone', '', { number: '+1234567890' })).toBe('tel:+1234567890');
  });

  it('builds an SMSTO: payload', () => {
    expect(buildQrPayload('sms', '', { number: '+1234567890', message: 'hello' })).toBe('SMSTO:+1234567890:hello');
  });

  it('builds a vCard with CRLF line breaks, as RFC 2426 requires', () => {
    const payload = buildQrPayload('vcard', '', { name: 'Jane Doe', phone: '', email: 'jane@x.com', org: '' });
    expect(payload).toBe('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jane Doe\r\nEMAIL:jane@x.com\r\nEND:VCARD');
  });

  it('escapes vCard TEXT separators so a comma or semicolon does not split the field', () => {
    const payload = buildQrPayload('vcard', '', { name: 'Doe;Jane', phone: '555', email: '', org: 'Acme, Inc.' });
    expect(payload).toContain('FN:Doe\\;Jane');
    expect(payload).toContain('ORG:Acme\\, Inc.');
  });

  it('builds a VCALENDAR/VEVENT payload with the RFC 5545 required PRODID, UID and DTSTAMP', () => {
    const payload = buildQrPayload('event', '', {
      title: 'Team sync',
      location: 'Room 4',
      description: 'Weekly catch-up',
      start: '2026-12-25T10:00',
      end: '2026-12-25T10:30',
    }, FIXED_NOW);
    expect(payload).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SnapVidly//QR Code Generator//EN',
        'BEGIN:VEVENT',
        'UID:d0ff9bf9@snapvidly.com',
        'DTSTAMP:20260102T030405Z',
        'SUMMARY:Team sync',
        'DTSTART:20261225T100000',
        'DTEND:20261225T103000',
        'LOCATION:Room 4',
        'DESCRIPTION:Weekly catch-up',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
  });

  it('escapes iCalendar TEXT separators in the summary, location and description', () => {
    const payload = buildQrPayload('event', '', { title: 'Launch party, take 2', location: 'Berlin, Germany', description: 'Bring a friend; snacks provided' }, FIXED_NOW);
    expect(payload).toContain('SUMMARY:Launch party\\, take 2');
    expect(payload).toContain('LOCATION:Berlin\\, Germany');
    expect(payload).toContain('DESCRIPTION:Bring a friend\\; snacks provided');
  });

  it('derives the event UID from the content, so the same event always encodes identically', () => {
    const fields = { title: 'Standup', start: '2026-03-01T09:00', end: '2026-03-01T09:15', location: 'Zoom' };
    expect(buildQrPayload('event', '', fields, FIXED_NOW)).toBe(buildQrPayload('event', '', fields, FIXED_NOW));
    expect(buildQrPayload('event', '', { ...fields, title: 'Retro' }, FIXED_NOW)).not.toBe(buildQrPayload('event', '', fields, FIXED_NOW));
  });

  it('builds an event payload with only the provided fields', () => {
    const payload = buildQrPayload('event', '', { title: 'Untitled event' }, FIXED_NOW);
    expect(payload).not.toContain('DTSTART');
    expect(payload).not.toContain('LOCATION');
    expect(payload).toContain('SUMMARY:Untitled event');
  });

  it('builds a geo: payload', () => {
    expect(buildQrPayload('geo', '', { lat: '40.6892', lon: '-74.0445' })).toBe('geo:40.6892,-74.0445');
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#3366cc', '#3366cc')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#112233', '#ddeeff')).toBeCloseTo(contrastRatio('#ddeeff', '#112233'), 10);
  });
});

describe('qrContrastWarning', () => {
  it('says nothing for classic dark-on-light', () => {
    expect(qrContrastWarning('#000000', '#ffffff', false)).toBeNull();
    expect(qrContrastWarning('#1a1a2e', '#f5f5f5', false)).toBeNull();
  });

  it('flags a washed-out foreground that a phone camera would miss', () => {
    expect(qrContrastWarning('#cccccc', '#ffffff', false)).toMatch(/too close together/);
  });

  it('flags inverted codes, which many scanners refuse outright', () => {
    expect(qrContrastWarning('#ffffff', '#000000', false)).toMatch(/inverted/);
  });

  it('judges a transparent background against white, since that is what it is laid on', () => {
    expect(qrContrastWarning('#000000', '#000000', true)).toBeNull();
    expect(qrContrastWarning('#eeeeee', '#000000', true)).toMatch(/inverted|too close/);
  });
});

describe('renderQrSvg (real qrcode engine, no browser needed)', () => {
  const opts = { errorCorrectionLevel: 'M', color: '#000000', background: '#ffffff', transparentBackground: false, width: 320 } as const;

  it('leaves a 4-module quiet zone, as ISO/IEC 18004 requires', async () => {
    const svg = await renderQrSvg('https://snapvidly.com', { ...opts });
    const modules = Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1]);
    expect(modules).toBeGreaterThan(8);
    // The first dark module starts 4 units in on both axes, and the grid is padded 4 on each side.
    expect(svg).toContain('d="M4 4.5h');
    expect(svg).toContain(`d="M0 0h${modules}v${modules}H0z"`);
  });

  it('omits the light background entirely when transparency is on', async () => {
    const svg = await renderQrSvg('https://snapvidly.com', { ...opts, transparentBackground: true });
    expect(svg).not.toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#000000"');
  });

  it('honours the requested pixel width while keeping the module viewBox', async () => {
    const svg = await renderQrSvg('https://snapvidly.com', { ...opts, width: 1024 });
    expect(svg).toContain('width="1024"');
    expect(svg).toContain('height="1024"');
  });

  it('rejects empty content with a typed error', async () => {
    await expect(renderQrSvg('   ', { ...opts })).rejects.toThrow(QrError);
  });

  it('rejects content too large for any QR version with a readable message', async () => {
    await expect(renderQrSvg('x'.repeat(5000), { ...opts })).rejects.toThrow(/too long to fit/);
  });
});
