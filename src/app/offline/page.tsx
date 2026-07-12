import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata = { title: 'Offline', robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <section className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-3xl font-bold text-ink">You’re offline</h1>
      <p className="mt-4 max-w-md text-ink-muted">
        SnapVidly needs a connection to fetch videos. Reconnect and try again — pages you’ve already
        visited will still load.
      </p>
      <Link href="/" className="btn-accent mt-8">
        Go to home
      </Link>
    </section>
  );
}
