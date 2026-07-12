import QRCode from 'qrcode';
import { InstallButton } from './InstallButton';
import { site } from '@/lib/site';

/**
 * "Get the app" section. The QR code is rendered to inline SVG at BUILD time
 * (server component) — zero client JS, no external QR service. Scanning it opens
 * the site on a phone, where the user installs the PWA (Android & iOS steps shown).
 */
export async function InstallApp() {
  const qrSvg = await QRCode.toString(site.url, {
    type: 'svg',
    margin: 0,
    width: 176,
    color: { dark: '#0F172A', light: '#00000000' },
  });

  return (
    <section className="container-page py-16" aria-labelledby="install-heading">
      <div className="card overflow-hidden">
        <div className="grid gap-8 p-8 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-12 md:p-10">
          {/* Copy + steps */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
              Progressive Web App
            </span>
            <h2 id="install-heading" className="mt-4 text-3xl">
              Install SnapVidly as an app
            </h2>
            <p className="mt-3 max-w-md text-ink-muted">
              Add SnapVidly to your home screen for one-tap access, a full-screen app feel, and offline
              browsing. No app store, no download — it installs from your browser.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <PlatformBadge label="Android" /> Android &amp; desktop
                </h3>
                <ol className="mt-2 space-y-1.5 text-sm text-ink-muted">
                  <li>1. Tap the button below, or your browser menu.</li>
                  <li>2. Choose <strong>Install</strong> / <strong>Add to Home screen</strong>.</li>
                  <li>3. Open SnapVidly from your home screen.</li>
                </ol>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <PlatformBadge label="iOS" /> iPhone &amp; iPad
                </h3>
                <ol className="mt-2 space-y-1.5 text-sm text-ink-muted">
                  <li>1. Open this site in <strong>Safari</strong>.</li>
                  <li>2. Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li>
                  <li>3. Tap <strong>Add</strong> — done.</li>
                </ol>
              </div>
            </div>

            <div className="mt-6">
              <InstallButton />
            </div>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-soft p-6">
            <div
              className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full"
              // Trusted, build-time generated SVG from our own site URL.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              role="img"
              aria-label={`QR code to open ${site.name} on your phone`}
            />
            <p className="mt-4 text-center text-sm font-medium text-ink">Scan to open on your phone</p>
            <p className="mt-1 text-center text-xs text-ink-muted">Point your camera here, then install.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md bg-ink px-2 text-xs font-semibold text-white">
      {label}
    </span>
  );
}
