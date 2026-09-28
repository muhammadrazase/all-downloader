'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QrError, buildQrPayload, qrContrastWarning, type QrType } from '@/lib/qr';

type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

const QR_TYPES: { id: QrType; label: string }[] = [
  { id: 'text', label: 'URL / Text' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'sms', label: 'SMS' },
  { id: 'vcard', label: 'Contact (vCard)' },
  { id: 'event', label: 'Calendar Event' },
  { id: 'geo', label: 'Location' },
];

const SIZES = [240, 320, 480, 640, 1024];

const inputClass = 'h-10 rounded-md border border-surface-border bg-surface px-2 text-ink';
const labelClass = 'flex flex-col gap-1 text-sm text-ink-muted';

export function QrCodeBox() {
  const [type, setType] = useState<QrType>('text');
  const [text, setText] = useState('');
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [encryption, setEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [phone, setPhone] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [vcardName, setVcardName] = useState('');
  const [vcardPhone, setVcardPhone] = useState('');
  const [vcardEmail, setVcardEmail] = useState('');
  const [vcardOrg, setVcardOrg] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [geoLat, setGeoLat] = useState('');
  const [geoLon, setGeoLon] = useState('');

  const [color, setColor] = useState('#000000');
  const [background, setBackground] = useState('#ffffff');
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrection>('M');
  const [size, setSize] = useState(320);
  const [message, setMessage] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload = useMemo(() => {
    switch (type) {
      case 'wifi': return buildQrPayload('wifi', '', { ssid, password: wifiPassword, encryption, hidden: wifiHidden });
      case 'email': return buildQrPayload('email', '', { address: emailAddress, subject: emailSubject, body: emailBody });
      case 'phone': return buildQrPayload('phone', '', { number: phone });
      case 'sms': return buildQrPayload('sms', '', { number: smsNumber, message: smsMessage });
      case 'vcard': return buildQrPayload('vcard', '', { name: vcardName, phone: vcardPhone, email: vcardEmail, org: vcardOrg });
      case 'event': return buildQrPayload('event', '', { title: eventTitle, location: eventLocation, description: eventDescription, start: eventStart, end: eventEnd });
      case 'geo': return buildQrPayload('geo', '', { lat: geoLat, lon: geoLon });
      default: return buildQrPayload('text', text, {});
    }
  }, [type, text, ssid, wifiPassword, encryption, wifiHidden, emailAddress, emailSubject, emailBody, phone, smsNumber, smsMessage, vcardName, vcardPhone, vcardEmail, vcardOrg, eventTitle, eventLocation, eventDescription, eventStart, eventEnd, geoLat, geoLon]);

  const hasContent = useMemo(() => {
    if (type === 'wifi') return ssid.trim().length > 0;
    if (type === 'email') return emailAddress.trim().length > 0;
    if (type === 'phone') return phone.trim().length > 0;
    if (type === 'sms') return smsNumber.trim().length > 0;
    if (type === 'vcard') return vcardName.trim().length > 0;
    if (type === 'event') return eventTitle.trim().length > 0;
    if (type === 'geo') return geoLat.trim().length > 0 && geoLon.trim().length > 0;
    return text.trim().length > 0;
  }, [type, text, ssid, emailAddress, phone, smsNumber, vcardName, eventTitle, geoLat, geoLon]);

  const contrastWarning = useMemo(
    () => qrContrastWarning(color, background, transparentBackground),
    [color, background, transparentBackground],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clear = () => canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    if (!hasContent) {
      clear();
      setMessage('');
      return;
    }
    let cancelled = false;
    (async () => {
      const { renderQrCode } = await import('@/lib/qr');
      try {
        await renderQrCode(canvas, payload, { errorCorrectionLevel: errorCorrection, color, background, transparentBackground, width: size });
        if (!cancelled) setMessage('');
      } catch (e) {
        if (cancelled) return;
        clear(); // never leave a stale code on screen that no longer matches the input
        setMessage(e instanceof QrError ? e.message : 'Could not generate a QR code for this content.');
      }
    })();
    return () => { cancelled = true; };
  }, [payload, hasContent, color, background, transparentBackground, errorCorrection, size]);

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-code.png';
    a.click();
  }, []);

  const downloadSvg = useCallback(async () => {
    if (!hasContent) return;
    const { renderQrSvg } = await import('@/lib/qr');
    try {
      const svg = await renderQrSvg(payload, { errorCorrectionLevel: errorCorrection, color, background, transparentBackground, width: size });
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-code.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e instanceof QrError ? e.message : 'Could not generate a QR code for this content.');
    }
  }, [payload, hasContent, errorCorrection, color, background, transparentBackground, size]);

  return (
    <div className="w-full">
      <label htmlFor="qr-type" className="sr-only">QR code type</label>
      <div className="flex flex-wrap gap-2">
        {QR_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            aria-pressed={type === t.id}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${type === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:bg-surface-soft'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {type === 'text' && (
          <label htmlFor="qr-text" className={labelClass}>
            Link or text
            <input id="qr-text" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a link or type text…" className={inputClass} />
          </label>
        )}
        {type === 'wifi' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>Network name (SSID)<input type="text" value={ssid} onChange={(e) => setSsid(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Password<input type="text" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} disabled={encryption === 'nopass'} className={`${inputClass} disabled:opacity-40`} /></label>
            <label className={labelClass}>
              Security
              <select aria-label="Security" value={encryption} onChange={(e) => setEncryption(e.target.value as typeof encryption)} className={inputClass}>
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">None (open network)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-muted">
              <input type="checkbox" checked={wifiHidden} onChange={(e) => setWifiHidden(e.target.checked)} className="h-4 w-4 accent-accent" />
              Hidden network
            </label>
          </div>
        )}
        {type === 'email' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>Email address<input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Subject (optional)<input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Body (optional)<textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={2} className="resize-y rounded-md border border-surface-border bg-surface p-2 text-ink" /></label>
          </div>
        )}
        {type === 'phone' && (
          <label className={labelClass}>Phone number<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className={inputClass} /></label>
        )}
        {type === 'sms' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>Phone number<input type="tel" value={smsNumber} onChange={(e) => setSmsNumber(e.target.value)} placeholder="+1 555 123 4567" className={inputClass} /></label>
            <label className={labelClass}>Message (optional)<input type="text" value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} className={inputClass} /></label>
          </div>
        )}
        {type === 'vcard' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>Full name<input type="text" value={vcardName} onChange={(e) => setVcardName(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Organization (optional)<input type="text" value={vcardOrg} onChange={(e) => setVcardOrg(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Phone (optional)<input type="tel" value={vcardPhone} onChange={(e) => setVcardPhone(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Email (optional)<input type="email" value={vcardEmail} onChange={(e) => setVcardEmail(e.target.value)} className={inputClass} /></label>
          </div>
        )}
        {type === 'event' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>Title<input type="text" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Starts (optional)<input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Ends (optional)<input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Location (optional)<input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Description (optional)<input type="text" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} className={inputClass} /></label>
          </div>
        )}
        {type === 'geo' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>Latitude<input type="text" inputMode="decimal" value={geoLat} onChange={(e) => setGeoLat(e.target.value)} placeholder="40.6892" className={inputClass} /></label>
            <label className={labelClass}>Longitude<input type="text" inputMode="decimal" value={geoLon} onChange={(e) => setGeoLon(e.target.value)} placeholder="-74.0445" className={inputClass} /></label>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className={labelClass}>Foreground<input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-surface-border" /></label>
        <label className={labelClass}>Background<input type="color" value={background} disabled={transparentBackground} onChange={(e) => setBackground(e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-surface-border disabled:opacity-40" /></label>
        <label className={labelClass}>
          Error correction
          <select aria-label="Error correction" value={errorCorrection} onChange={(e) => setErrorCorrection(e.target.value as ErrorCorrection)} className={inputClass}>
            <option value="L">Low</option>
            <option value="M">Medium</option>
            <option value="Q">Quartile</option>
            <option value="H">High</option>
          </select>
        </label>
        <label className={labelClass}>
          Size
          <select aria-label="Size" value={size} onChange={(e) => setSize(Number(e.target.value))} className={inputClass}>
            {SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
          <input type="checkbox" checked={transparentBackground} onChange={(e) => setTransparentBackground(e.target.checked)} className="h-4 w-4 accent-accent" />
          Transparent background
        </label>
      </div>

      <div
        className={`mt-4 flex justify-center rounded-lg border border-surface-border p-6 ${transparentBackground ? '' : 'bg-surface-soft'}`}
        style={
          transparentBackground
            ? {
                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              }
            : undefined
        }
      >
        <canvas ref={canvasRef} width={size} height={size} className="max-w-full" />
      </div>

      <div aria-live="polite" className="mt-3 flex flex-col gap-2">
        {message && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {!message && contrastWarning && <p className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">{contrastWarning}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={downloadPng} disabled={!hasContent || !!message} className="btn-accent">Download PNG</button>
        <button type="button" onClick={downloadSvg} disabled={!hasContent || !!message} className="btn-ghost">Download SVG</button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Nothing is sent to a server — the QR code is generated entirely in your browser.</p>
    </div>
  );
}
