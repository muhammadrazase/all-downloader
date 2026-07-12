import Link from 'next/link';
import { PLATFORM_LIST } from '@/lib/platforms';

export default function NotFound() {
  return (
    <section className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-3 text-4xl font-bold text-ink">Page not found</h1>
      <p className="mt-4 max-w-md text-ink-muted">
        The page you’re looking for doesn’t exist or has moved. Try one of our downloaders instead.
      </p>
      <Link href="/" className="btn-accent mt-8">
        Back to home
      </Link>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {PLATFORM_LIST.map((p) => (
          <Link key={p.key} href={`/${p.slug}`} className="btn-ghost">
            {p.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
