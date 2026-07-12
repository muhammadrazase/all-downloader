import type { Faq } from '@/lib/platforms';

/**
 * FAQ list using native <details> — zero JS, fully accessible, and the matching
 * FAQPage JSON-LD is emitted separately for rich results.
 */
export function FAQ({ faqs, heading = 'Frequently asked questions' }: { faqs: Faq[]; heading?: string }) {
  return (
    <section className="mx-auto max-w-prose" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-2xl">
        {heading}
      </h2>
      <div className="mt-6 divide-y divide-surface-border">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
              {f.q}
              <svg
                className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </summary>
            <p className="mt-3 text-ink-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
