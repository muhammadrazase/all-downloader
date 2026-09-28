import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: `Down for maintenance | ${site.name}`,
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-bold text-ink">We&apos;ll be right back</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-muted">
        {site.name} is down for scheduled maintenance. Please check back shortly.
      </p>
    </section>
  );
}
