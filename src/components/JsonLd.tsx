import { serializeJsonLd } from '@/lib/jsonLdSerialize';

/** Renders a JSON-LD block. Server component — no client JS shipped. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
